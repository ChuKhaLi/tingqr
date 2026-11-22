using System;
using System.Globalization;
using System.Text;

namespace TingQR
{
    /// <summary>
    /// Checks a <c>fallbackUrl</c> and returns what the WHATWG URL Standard serialises it to (<c>href</c>), for the
    /// subset of URLs tingqr accepts (conformance/README.md, "Mẫu link mở app"). Not a full WHATWG parser: it accepts
    /// absolute <c>http:</c>/<c>https:</c> URLs with a domain or a dotted-decimal IPv4 host, and throws
    /// <c>INVALID_VALUE</c> for anything else, including some URLs WHATWG would accept and rewrite (user info, IPv6
    /// literals, non-canonical IPv4 such as <c>0x7f.1</c>, percent signs or backslashes in the host, backslashes and
    /// <c>.</c>/<c>..</c> segments in the path). Unicode hosts go through <see cref="IdnMapping"/>, which uses ICU on
    /// Linux and Windows' own tables on .NET Framework, so a Unicode host outside the vectors may come out differently
    /// from the TypeScript version.
    /// </summary>
    internal static class FallbackUrl
    {
        private static readonly IdnMapping Idn = new IdnMapping();

        private static TingQrException NotAbsolute(string url)
            => new TingQrException(TingQrErrorCode.InvalidValue, $"fallbackUrl must be an absolute http(s) URL, got \"{url}\".");

        /// <summary>The <c>href</c> of <paramref name="url"/>; throws <c>INVALID_VALUE</c> when tingqr does not accept it.</summary>
        public static string Normalize(string? url)
        {
            if (url == null) throw new TingQrException(TingQrErrorCode.InvalidValue, "fallbackUrl must be an absolute http(s) URL, got null.");
            var s = Strip(url);

            // Scheme: ALPHA *(ALPHA / DIGIT / "+" / "-" / ".") ":"
            var colon = s.IndexOf(':');
            if (colon < 1 || !IsAsciiLetter(s[0])) throw NotAbsolute(url);
            for (var i = 1; i < colon; i++)
            {
                var c = s[i];
                if (!IsAsciiLetter(c) && !IsAsciiDigit(c) && c != '+' && c != '-' && c != '.') throw NotAbsolute(url);
            }
            var scheme = s.Substring(0, colon).ToLowerInvariant();
            if (scheme != "http" && scheme != "https")
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue, $"fallbackUrl must use https: or http:, got {scheme}:");
            }

            // Special schemes ignore any number of slashes after the colon: https:a.vn and https:///a.vn are https://a.vn/.
            var start = colon + 1;
            while (start < s.Length && s[start] == '/') start++;
            var end = start;
            while (end < s.Length && s[end] != '/' && s[end] != '?' && s[end] != '#') end++;
            var authority = s.Substring(start, end - start);
            var rest = s.Substring(end);

            var hash = rest.IndexOf('#');
            var fragment = hash < 0 ? null : rest.Substring(hash + 1);
            if (hash >= 0) rest = rest.Substring(0, hash);
            var question = rest.IndexOf('?');
            var query = question < 0 ? null : rest.Substring(question + 1);
            var path = question < 0 ? rest : rest.Substring(0, question);

            var sb = new StringBuilder(scheme).Append("://").Append(HostAndPort(authority, scheme, url));
            sb.Append(Path(path, url));
            if (query != null) Encode(sb.Append('?'), query, IsInQuerySet);
            if (fragment != null) Encode(sb.Append('#'), fragment, IsInFragmentSet);
            return sb.ToString();
        }

        // WHATWG: strip leading and trailing C0 controls and spaces, then remove every tab and newline.
        private static string Strip(string url)
        {
            var a = 0;
            var b = url.Length;
            while (a < b && url[a] <= ' ') a++;
            while (b > a && url[b - 1] <= ' ') b--;
            var sb = new StringBuilder(b - a);
            for (var i = a; i < b; i++)
            {
                var c = url[i];
                if (c != '\t' && c != '\n' && c != '\r') sb.Append(c);
            }
            return sb.ToString();
        }

        private static string HostAndPort(string authority, string scheme, string url)
        {
            if (authority.IndexOf('@') >= 0 || authority.IndexOf('[') >= 0 || authority.IndexOf('\\') >= 0 || authority.IndexOf('%') >= 0)
            {
                throw NotAbsolute(url);
            }
            var host = authority;
            string? port = null;
            var colon = authority.LastIndexOf(':');
            if (colon >= 0)
            {
                host = authority.Substring(0, colon);
                port = Port(authority.Substring(colon + 1), scheme, url);
            }
            return Host(host, url) + (port == null ? "" : ":" + port);
        }

        // Digits only, at most 65535; the scheme's default port is dropped, as is an empty port.
        private static string? Port(string text, string scheme, string url)
        {
            if (text.Length == 0) return null;
            var value = 0;
            foreach (var c in text)
            {
                if (!IsAsciiDigit(c)) throw NotAbsolute(url);
                value = value * 10 + (c - '0');
                if (value > 65535) throw NotAbsolute(url);
            }
            if ((scheme == "http" && value == 80) || (scheme == "https" && value == 443)) return null;
            return value.ToString(CultureInfo.InvariantCulture);
        }

        private static string Host(string host, string url)
        {
            if (host.Length == 0) throw NotAbsolute(url);
            string ascii;
            if (IsAscii(host) && !HasPunycodeLabel(host))
            {
                ascii = host.ToLowerInvariant();
            }
            else
            {
                try
                {
                    var lower = host.ToLowerInvariant();
                    ascii = Idn.GetAscii(lower).ToLowerInvariant();
                    // An xn-- label must decode to what it encodes (WHATWG rejects bad Punycode such as xn--abc).
                    if (Idn.GetAscii(Idn.GetUnicode(ascii)).ToLowerInvariant() != ascii) throw NotAbsolute(url);
                }
                catch (ArgumentException)
                {
                    throw NotAbsolute(url);
                }
            }
            foreach (var c in ascii)
            {
                if (c <= ' ' || c >= 0x7F || "#/:<>?@[\\]^|%".IndexOf(c) >= 0) throw NotAbsolute(url);
            }
            if (EndsInANumber(ascii) && !IsCanonicalIpv4(ascii)) throw NotAbsolute(url);
            return ascii;
        }

        private static bool HasPunycodeLabel(string host)
        {
            foreach (var label in host.Split('.'))
            {
                if (label.StartsWith("xn--", StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        // WHATWG "ends in a number": the last label (ignoring one trailing empty label) is digits or 0x-hex. Such
        // a host is parsed as IPv4.
        private static bool EndsInANumber(string host)
        {
            var labels = host.Split('.');
            var n = labels.Length;
            if (n > 1 && labels[n - 1].Length == 0) n--;
            var last = labels[n - 1];
            if (last.Length > 0 && AllDigits(last)) return true;
            return last.StartsWith("0x", StringComparison.Ordinal);
        }

        // Only the form WHATWG serialises unchanged: four decimal parts 0-255 without leading zeros.
        private static bool IsCanonicalIpv4(string host)
        {
            var parts = host.Split('.');
            if (parts.Length != 4) return false;
            foreach (var p in parts)
            {
                if (p.Length == 0 || p.Length > 3 || !AllDigits(p) || (p.Length > 1 && p[0] == '0')) return false;
                if (int.Parse(p, NumberStyles.None, CultureInfo.InvariantCulture) > 255) return false;
            }
            return true;
        }

        private static string Path(string path, string url)
        {
            if (path.Length == 0) return "/";
            if (path.IndexOf('\\') >= 0) throw NotAbsolute(url);
            foreach (var segment in path.Split('/'))
            {
                var d = segment.Replace("%2e", ".").Replace("%2E", ".");
                if (d == "." || d == "..") throw NotAbsolute(url);
            }
            return Encode(new StringBuilder(), path, IsInPathSet).ToString();
        }

        // Percent-encode sets of the URL Standard. All three include the C0 control set (C0 controls and > U+007E).
        private static bool IsInC0Set(int cp) => cp < 0x20 || cp > 0x7E;

        private static bool IsInFragmentSet(int cp) => IsInC0Set(cp) || cp == ' ' || cp == '"' || cp == '<' || cp == '>' || cp == '`';

        private static bool IsInQuerySet(int cp) => IsInC0Set(cp) || cp == ' ' || cp == '"' || cp == '#' || cp == '<' || cp == '>' || cp == '\'';

        private static bool IsInPathSet(int cp) => (IsInQuerySet(cp) && cp != '\'') || cp == '?' || cp == '`' || cp == '{' || cp == '}';

        /// <summary>Appends <paramref name="text"/>, percent-encoding (UTF-8) each code point in the set; a lone surrogate becomes U+FFFD.</summary>
        private static StringBuilder Encode(StringBuilder sb, string text, Func<int, bool> inSet)
        {
            var bytes = new byte[4];
            for (var i = 0; i < text.Length; i++)
            {
                int cp = text[i];
                if (char.IsHighSurrogate(text[i]) && i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
                {
                    cp = char.ConvertToUtf32(text[i], text[i + 1]);
                    i++;
                }
                else if (char.IsSurrogate(text[i]))
                {
                    cp = 0xFFFD;
                }
                if (!inSet(cp))
                {
                    sb.Append((char)cp);
                    continue;
                }
                var n = Utf8(cp, bytes);
                for (var k = 0; k < n; k++) sb.Append('%').Append(bytes[k].ToString("X2", CultureInfo.InvariantCulture));
            }
            return sb;
        }

        private static int Utf8(int cp, byte[] b)
        {
            if (cp < 0x80)
            {
                b[0] = (byte)cp;
                return 1;
            }
            if (cp < 0x800)
            {
                b[0] = (byte)(0xC0 | (cp >> 6));
                b[1] = (byte)(0x80 | (cp & 0x3F));
                return 2;
            }
            if (cp < 0x10000)
            {
                b[0] = (byte)(0xE0 | (cp >> 12));
                b[1] = (byte)(0x80 | ((cp >> 6) & 0x3F));
                b[2] = (byte)(0x80 | (cp & 0x3F));
                return 3;
            }
            b[0] = (byte)(0xF0 | (cp >> 18));
            b[1] = (byte)(0x80 | ((cp >> 12) & 0x3F));
            b[2] = (byte)(0x80 | ((cp >> 6) & 0x3F));
            b[3] = (byte)(0x80 | (cp & 0x3F));
            return 4;
        }

        /// <summary>
        /// ECMAScript <c>encodeURIComponent</c> of an ASCII string: keeps <c>A–Z a–z 0–9 - _ . ! ~ * ' ( )</c>,
        /// everything else becomes <c>%XX</c> (upper case). <see cref="Uri.EscapeDataString(string)"/> also escapes
        /// <c>! * ' ( )</c>, so it is not used.
        /// </summary>
        public static string EncodeUriComponent(string ascii)
        {
            var sb = new StringBuilder(ascii.Length * 2);
            foreach (var c in ascii)
            {
                if (IsAsciiLetter(c) || IsAsciiDigit(c) || "-_.!~*'()".IndexOf(c) >= 0) sb.Append(c);
                else sb.Append('%').Append(((int)c).ToString("X2", CultureInfo.InvariantCulture));
            }
            return sb.ToString();
        }

        private static bool IsAsciiLetter(char c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

        private static bool IsAsciiDigit(char c) => c >= '0' && c <= '9';

        private static bool AllDigits(string s)
        {
            foreach (var c in s)
            {
                if (!IsAsciiDigit(c)) return false;
            }
            return true;
        }

        private static bool IsAscii(string s)
        {
            foreach (var c in s)
            {
                if (c > 0x7F) return false;
            }
            return true;
        }
    }
}

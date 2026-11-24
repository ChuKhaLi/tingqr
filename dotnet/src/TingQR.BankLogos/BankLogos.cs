using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;

namespace TingQR
{
    /// <summary>
    /// Vietnamese bank logos (keyed by bank BIN) and banking-app icons (keyed by app id), embedded in the assembly.
    /// The images are trademarks of their owners and are not MIT-licensed; see LOGOS-NOTICE.md in the package.
    /// Keys are matched exactly (ordinal, no trimming).
    /// </summary>
    public static class BankLogos
    {
        private const string Prefix = "TingQR.BankLogos/";

        private static readonly Assembly Asm = typeof(BankLogos).Assembly;

        private static readonly Lazy<string[]> Names = new Lazy<string[]>(() => Asm.GetManifestResourceNames());

        private static readonly ConcurrentDictionary<string, string?> Uris = new ConcurrentDictionary<string, string?>(StringComparer.Ordinal);

        private static readonly Lazy<IReadOnlyList<string>> LogoKeys = new Lazy<IReadOnlyList<string>>(() => Keys("logo/"));

        private static readonly Lazy<IReadOnlyList<string>> IconKeys = new Lazy<IReadOnlyList<string>>(() => Keys("icon/"));

        /// <summary>Bank BINs that have a logo, sorted ordinally.</summary>
        public static IReadOnlyList<string> LogoBins => LogoKeys.Value;

        /// <summary>App ids (as in <c>BankApps</c>) that have an icon, sorted ordinally.</summary>
        public static IReadOnlyList<string> IconIds => IconKeys.Value;

        /// <summary>The logo of the bank with this BIN as a <c>data:</c> URI, or <c>null</c> when there is none.</summary>
        /// <exception cref="ArgumentNullException"><paramref name="bin"/> is <c>null</c>.</exception>
        public static string? Logo(string bin) => DataUri("logo/", bin ?? throw new ArgumentNullException(nameof(bin)));

        /// <summary>The icon of the app with this id as a <c>data:</c> URI, or <c>null</c> when there is none.</summary>
        /// <exception cref="ArgumentNullException"><paramref name="appId"/> is <c>null</c>.</exception>
        public static string? Icon(string appId) => DataUri("icon/", appId ?? throw new ArgumentNullException(nameof(appId)));

        /// <summary>Opens the logo file of the bank with this BIN, or <c>null</c>. The caller disposes the result.</summary>
        /// <exception cref="ArgumentNullException"><paramref name="bin"/> is <c>null</c>.</exception>
        public static BankLogoFile? OpenLogo(string bin) => Open("logo/", bin ?? throw new ArgumentNullException(nameof(bin)));

        /// <summary>Opens the icon file of the app with this id, or <c>null</c>. The caller disposes the result.</summary>
        /// <exception cref="ArgumentNullException"><paramref name="appId"/> is <c>null</c>.</exception>
        public static BankLogoFile? OpenIcon(string appId) => Open("icon/", appId ?? throw new ArgumentNullException(nameof(appId)));

        private static IReadOnlyList<string> Keys(string kind)
        {
            var start = Prefix + kind;
            return Names.Value
                .Where(n => n.StartsWith(start, StringComparison.Ordinal))
                .Select(n => Path.GetFileNameWithoutExtension(n))
                .OrderBy(k => k, StringComparer.Ordinal)
                .ToArray();
        }

        private static string? ResourceName(string kind, string key)
        {
            var start = Prefix + kind + key + ".";
            return Names.Value.FirstOrDefault(n => n.StartsWith(start, StringComparison.Ordinal)
                && n.IndexOf('.', start.Length) == -1);
        }

        private static string? DataUri(string kind, string key)
            => Uris.GetOrAdd(kind + key, _ =>
            {
                var name = ResourceName(kind, key);
                if (name == null)
                {
                    return null;
                }
                using var stream = Asm.GetManifestResourceStream(name)!;
                using var ms = new MemoryStream();
                stream.CopyTo(ms);
                var bytes = ms.ToArray();
                return "data:" + MimeOf(name, bytes) + ";base64," + Convert.ToBase64String(bytes);
            });

        private static BankLogoFile? Open(string kind, string key)
        {
            var name = ResourceName(kind, key);
            if (name == null)
            {
                return null;
            }
            var stream = Asm.GetManifestResourceStream(name)!;
            // Sniff the type from the content, as the data URI does; a mislabelled file is a build error in the repo.
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            stream.Dispose();
            var bytes = ms.ToArray();
            return new BankLogoFile(new MemoryStream(bytes, false), MimeOf(name, bytes), name.Substring(Prefix.Length + kind.Length));
        }

        /// <summary>MIME from the bytes, checked against the extension (as the TypeScript build does).</summary>
        private static string MimeOf(string name, byte[] bytes)
        {
            var ext = name.Substring(name.LastIndexOf('.') + 1);
            string? sniffed = null;
            if (bytes.Length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P')
            {
                sniffed = "webp";
            }
            else
            {
                var head = Encoding.UTF8.GetString(bytes, 0, Math.Min(bytes.Length, 4096));
                var at = head.IndexOf("<svg", StringComparison.Ordinal);
                if (at != -1 && at + 4 < head.Length && (head[at + 4] == '>' || char.IsWhiteSpace(head[at + 4])))
                {
                    sniffed = "svg";
                }
            }
            if (sniffed != ext)
            {
                throw new InvalidOperationException(name + ": content is " + (sniffed ?? "unknown") + ", extension says " + ext);
            }
            return ext == "svg" ? "image/svg+xml" : "image/webp";
        }
    }

    /// <summary>A logo or icon file opened from <see cref="BankLogos"/>. Dispose it to release <see cref="Content"/>.</summary>
    public sealed class BankLogoFile : IDisposable
    {
        internal BankLogoFile(Stream content, string contentType, string fileName)
        {
            Content = content;
            ContentType = contentType;
            FileName = fileName;
        }

        /// <summary>The file bytes, positioned at the start.</summary>
        public Stream Content { get; }

        /// <summary>MIME type: <c>image/svg+xml</c> or <c>image/webp</c>.</summary>
        public string ContentType { get; }

        /// <summary>File name with extension, for example <c>mb.webp</c>.</summary>
        public string FileName { get; }

        /// <inheritdoc />
        public void Dispose() => Content.Dispose();
    }
}

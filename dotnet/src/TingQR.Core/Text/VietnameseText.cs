using System;
using System.Globalization;
using System.Text;

namespace TingQR
{
    /// <summary>Text helpers for Vietnamese.</summary>
    public static class VietnameseText
    {
        /// <summary>
        /// Removes Vietnamese tone and vowel marks from Latin letters and maps đ/Đ to d/D. Marks on other scripts
        /// are left alone, and the result is NFC-normalised. A lone surrogate is kept as it is, like JavaScript's
        /// <c>normalize</c> in the TypeScript <c>removeVietnameseAccents</c>.
        /// </summary>
        /// <exception cref="ArgumentNullException"><paramref name="s"/> is null.</exception>
        public static string RemoveAccents(string s)
        {
            if (s == null) throw new ArgumentNullException(nameof(s));
            var d = Normalize(s, NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            var i = 0;
            while (i < d.Length)
            {
                var c = d[i];
                sb.Append(c == 'đ' ? 'd' : c == 'Đ' ? 'D' : c);
                i++;
                // /([A-Za-z])\p{M}+/u: drop the marks (code points, so a mark outside the BMP too) after a Latin letter.
                if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))
                {
                    while (i < d.Length && IsMark(d, i)) i += char.IsHighSurrogate(d[i]) ? 2 : 1;
                }
            }
            return Normalize(sb.ToString(), NormalizationForm.FormC);
        }

        // The category of the code point at i; a lone surrogate is OtherNotAssigned/Surrogate, never a mark.
        private static bool IsMark(string s, int i)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(s, i);
            return category == UnicodeCategory.NonSpacingMark || category == UnicodeCategory.SpacingCombiningMark
                || category == UnicodeCategory.EnclosingMark;
        }

        // string.Normalize throws on a lone surrogate; JavaScript keeps it and normalises the text on each side. A lone
        // surrogate never composes or reorders with its neighbours, so normalising the runs between them is the same.
        private static string Normalize(string s, NormalizationForm form)
        {
            var sb = new StringBuilder(s.Length);
            var start = 0;
            for (var i = 0; i < s.Length; i++)
            {
                if (!char.IsSurrogate(s[i])) continue;
                if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                {
                    i++;
                    continue;
                }
                sb.Append(s.Substring(start, i - start).Normalize(form)).Append(s[i]);
                start = i + 1;
            }
            return sb.Append(s.Substring(start).Normalize(form)).ToString();
        }
    }
}

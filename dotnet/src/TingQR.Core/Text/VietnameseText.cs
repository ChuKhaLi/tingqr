using System.Text;
using System.Text.RegularExpressions;

namespace TingQR
{
    /// <summary>Text helpers for Vietnamese.</summary>
    public static class VietnameseText
    {
        private static readonly Regex Marks = new Regex(@"([A-Za-z])\p{M}+", RegexOptions.CultureInvariant);

        /// <summary>
        /// Removes Vietnamese tone and vowel marks from Latin letters and maps đ/Đ to d/D. Marks on other scripts
        /// are left alone, and the result is NFC-normalised.
        /// </summary>
        public static string RemoveAccents(string s)
        {
            var d = Marks.Replace(s.Normalize(NormalizationForm.FormD), "$1");
            return d.Replace("đ", "d").Replace("Đ", "D").Normalize(NormalizationForm.FormC);
        }
    }
}

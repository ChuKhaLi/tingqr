using System.Collections.Generic;

namespace TingQR
{
    /// <summary>Unicode code point helpers; EMV lengths count code points, not UTF-16 units.</summary>
    internal static class CodePoints
    {
        /// <summary>Number of code points; a surrogate pair counts once, a lone surrogate counts once.</summary>
        public static int Count(string s)
        {
            var n = 0;
            for (var i = 0; i < s.Length; i++)
            {
                if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) i++;
                n++;
            }
            return n;
        }

        /// <summary>Splits into one string per code point.</summary>
        public static List<string> Split(string s)
        {
            var list = new List<string>(s.Length);
            for (var i = 0; i < s.Length; i++)
            {
                if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                {
                    list.Add(s.Substring(i, 2));
                    i++;
                }
                else
                {
                    list.Add(s[i].ToString());
                }
            }
            return list;
        }
    }
}

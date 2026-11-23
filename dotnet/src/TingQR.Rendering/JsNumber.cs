using System;
using System.Globalization;
using System.Numerics;

namespace TingQR.Rendering
{
    /// <summary>
    /// JavaScript's <c>String(n)</c> for a double (ECMAScript Number::toString with radix 10). Shortest round-trip digits
    /// are found with exact integer arithmetic (<see cref="BigInteger"/>), so the result is the same on every target
    /// framework: .NET Framework's "R" format is not always shortest, and its parser is not always correctly rounded.
    /// </summary>
    internal static class JsNumber
    {
        public static string ToString(double value)
        {
            if (double.IsNaN(value)) return "NaN";
            if (value == 0) return "0"; // both +0 and -0
            if (value < 0) return "-" + ToString(-value);
            if (double.IsPositiveInfinity(value)) return "Infinity";

            ShortestDigits(value, out var digits, out var n);
            return Format(digits, n);
        }

        /// <summary>
        /// ECMAScript Number::toString steps 6–10 for positive x = 0.d1d2…dk × 10^n, where <paramref name="digits"/> is
        /// d1…dk (no trailing zeros).
        /// </summary>
        private static string Format(string digits, int n)
        {
            var k = digits.Length;
            if (k <= n && n <= 21) return digits + new string('0', n - k);
            if (0 < n && n <= 21) return digits.Substring(0, n) + "." + digits.Substring(n);
            if (-6 < n && n <= 0) return "0." + new string('0', -n) + digits;
            var e = n - 1;
            var exponent = (e < 0 ? "e-" : "e+") + Math.Abs(e).ToString(CultureInfo.InvariantCulture);
            if (k == 1) return digits + exponent;
            return digits.Substring(0, 1) + "." + digits.Substring(1) + exponent;
        }

        /// <summary>
        /// The fewest decimal digits s × 10^p that read back as <paramref name="x"/> (finite, positive) under round to
        /// nearest, ties to even; among those, the one closest to x (ties to even s). Returns s without trailing zeros and
        /// n such that x ≈ 0.s × 10^n.
        /// </summary>
        private static void ShortestDigits(double x, out string digits, out int n)
        {
            var bits = BitConverter.DoubleToInt64Bits(x);
            var biased = (int)((bits >> 52) & 0x7FF);
            var fraction = bits & 0xFFFFFFFFFFFFFL;
            long f;
            int e;
            if (biased == 0)
            {
                f = fraction;
                e = -1074;
            }
            else
            {
                f = fraction | (1L << 52);
                e = biased - 1075;
            }

            // In units of 2^(e-2): x = 4f, the rounding interval is [low, high] (open when f is odd). At a power of two
            // (not the smallest normal) the double below is closer, so the lower half-gap is halved.
            var unit = e - 2;
            var value = new BigInteger(f) * 4;
            var lowerGap = fraction == 0 && biased > 1 ? 1 : 2;
            var low = value - lowerGap;
            var high = value + 2;
            var inclusive = (f & 1) == 0;

            // decimal exponent E with 10^E <= x < 10^(E+1)
            var exp10 = (int)Math.Floor(Math.Log10(x));
            while (Compare(BigInteger.One, exp10, value, unit) > 0) exp10--;
            while (Compare(BigInteger.One, exp10 + 1, value, unit) <= 0) exp10++;

            for (var count = 1; ; count++)
            {
                var p = exp10 - count + 1;
                var below = FloorDiv(value, unit, p);
                var above = below + 1;
                var belowOk = Within(below, p, low, high, unit, inclusive);
                var aboveOk = Within(above, p, low, high, unit, inclusive);
                if (!belowOk && !aboveOk) continue;

                BigInteger s;
                if (belowOk && aboveOk)
                {
                    // x against the midpoint (below + 1/2) × 10^p
                    var c = Compare(below * 2 + 1, p, value * 2, unit);
                    s = c > 0 ? below : c < 0 ? above : (below.IsEven ? below : above);
                }
                else
                {
                    s = belowOk ? below : above;
                }

                var text = s.ToString(CultureInfo.InvariantCulture);
                var trimmed = text.TrimEnd('0');
                digits = trimmed;
                n = p + text.Length;
                return;
            }
        }

        private static bool Within(BigInteger s, int p, BigInteger low, BigInteger high, int unit, bool inclusive)
        {
            var lo = Compare(s, p, low, unit);
            var hi = Compare(s, p, high, unit);
            return inclusive ? lo >= 0 && hi <= 0 : lo > 0 && hi < 0;
        }

        /// <summary>Compare s × 10^p with a × 2^u exactly.</summary>
        private static int Compare(BigInteger s, int p, BigInteger a, int u)
        {
            var left = s * Pow(10, Math.Max(p, 0)) * Pow(2, Math.Max(-u, 0));
            var right = a * Pow(2, Math.Max(u, 0)) * Pow(10, Math.Max(-p, 0));
            return left.CompareTo(right);
        }

        /// <summary>floor(a × 2^u / 10^p) for a ≥ 0.</summary>
        private static BigInteger FloorDiv(BigInteger a, int u, int p)
        {
            var numerator = a * Pow(2, Math.Max(u, 0)) * Pow(10, Math.Max(-p, 0));
            var denominator = Pow(10, Math.Max(p, 0)) * Pow(2, Math.Max(-u, 0));
            return BigInteger.Divide(numerator, denominator);
        }

        private static BigInteger Pow(int b, int exponent) => BigInteger.Pow(b, exponent);
    }
}

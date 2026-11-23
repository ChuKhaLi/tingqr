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
            // Math.Sign, not value < 0: zero is handled above, and the boundary of a comparison would be untestable.
            if (Math.Sign(value) == -1) return "-" + ToString(-value);
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
            // The spec's 0 < n <= 21, as n < 22: n == 21 never gets here (k <= 17 < 21 takes the line above), so the
            // reachable boundary is 22, and that is where the comparison sits.
            if (0 < n && n < 22) return digits.Substring(0, n) + "." + digits.Substring(n);
            if (-6 < n && n <= 0) return "0." + new string('0', -n) + digits;
            var e = n - 1;
            // The spec's e < 0: here n > 21 or n <= -6, so e >= 0 exactly when n >= 22 (the boundary that is reached).
            var exponent = (n >= 22 ? "e+" : "e-") + Math.Abs(e).ToString(CultureInfo.InvariantCulture);
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
            // x > 0, so the sign bit is 0 and the bits above the 52-bit fraction are the biased exponent alone.
            var biased = (int)(bits / 0x10000000000000L);
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
            // biased != 1 rather than > 1: fraction == 0 with biased == 0 would be zero, which never gets here.
            var lowerGap = fraction == 0 && biased != 1 ? 1 : 2;
            var low = value - lowerGap;
            var high = value + 2;
            var inclusive = (f & 1) == 0;

            // The loop below needs a start exp10 >= E (10^E <= x < 10^(E+1)), not E itself: a start above E only adds steps
            // whose candidates are 0 and 10^(E+1) (or larger), and taking 10^(E+1) there differs from the step at E only
            // if 9 × 10^E is also in range and closer, which needs a rounding range over 5% of x, i.e. a subnormal below
            // about 10 × 2^-1074 (a BigInt port of this method matched JavaScript's String for every multiple of 2^-1074 up
            // to 300000, every power of two and the doubles around every power of ten, 2026-11-23).
            // Math.Log10 is off by far less than 1, so floor + 1 is >= E.
            var exp10 = (int)Math.Floor(Math.Log10(x)) + 1;

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

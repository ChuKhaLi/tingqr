using System;
using Xunit;

namespace TingQR.Rendering.Tests
{
    public class JsNumberTests
    {
        // Expected strings printed by Node 22:
        // node -e "for (const n of [0,-0,100.5,0.1,1/3,1e21,1e-7,123456789012345680000,-1.5,5e-324,1.7976931348623157e308,1e-6,123e-20,0.000001234,1e20,2**53,0.1+0.2,-1e21,1.5e300,9.95,4.35,0.3]) console.log(String(n))"
        [Theory]
        [InlineData(0.0, "0")]
        [InlineData(100.5, "100.5")]
        [InlineData(0.1, "0.1")]
        [InlineData(1.0 / 3, "0.3333333333333333")]
        [InlineData(1e21, "1e+21")]
        [InlineData(1e-7, "1e-7")]
        [InlineData(123456789012345680000.0, "123456789012345680000")]
        [InlineData(-1.5, "-1.5")]
        [InlineData(5e-324, "5e-324")]
        [InlineData(1.7976931348623157e308, "1.7976931348623157e+308")]
        [InlineData(1e-6, "0.000001")]
        [InlineData(123e-20, "1.23e-18")]
        [InlineData(0.000001234, "0.000001234")]
        [InlineData(1e20, "100000000000000000000")]
        [InlineData(9007199254740992.0, "9007199254740992")]
        [InlineData(0.1 + 0.2, "0.30000000000000004")]
        [InlineData(-1e21, "-1e+21")]
        [InlineData(1.5e300, "1.5e+300")]
        [InlineData(9.95, "9.95")]
        [InlineData(4.35, "4.35")]
        [InlineData(0.3, "0.3")]
        public void MatchesJavaScriptString(double value, string expected)
        {
            Assert.Equal(expected, JsNumber.ToString(value));
        }

        // Built from their bits (net481's double.Parse is not correctly rounded). String and bits printed by:
        // node -e "const b=new DataView(new ArrayBuffer(8));for (const n of [2**-1022, 2**-1022 - 2**-1074, 2**1023, 1e23, 8.41e21, 5e-7]) {b.setFloat64(0,n);console.log(String(n),'0x'+b.getBigUint64(0).toString(16).toUpperCase())}"
        [Theory]
        [InlineData(0x10000000000000L, "2.2250738585072014e-308")] // 2^-1022, smallest normal: lower gap is half the upper
        [InlineData(0xFFFFFFFFFFFFFL, "2.225073858507201e-308")] // largest subnormal
        [InlineData(0x7FE0000000000000L, "8.98846567431158e+307")] // 2^1023, a power of two: lower gap halved
        [InlineData(0x44B52D02C7E14AF6L, "1e+23")]
        [InlineData(0x447C7E83209E90B2L, "8.41e+21")]
        [InlineData(0x3EA0C6F7A0B5ED8DL, "5e-7")]
        // Same script with [2**-1017, 562949953421312.25, 562949953421312.75, 2**54+4, 2**54+24, 2**54+8, 2**54+28]:
        [InlineData(0x60000000000000L, "7.120236347223045e-307")] // power of two where the halved lower gap changes the digits
        [InlineData(0x4300000000000002L, "562949953421312.2")] // x halfway between .2 and .3, both in range: the even one
        [InlineData(0x4300000000000006L, "562949953421312.8")] // halfway between .7 and .8: the even one
        [InlineData(0x4350000000000001L, "18014398509481988")] // odd significand: ...990 sits on the upper bound, excluded
        [InlineData(0x4350000000000006L, "18014398509482010")] // even significand: ...010 on the upper bound, included
        [InlineData(0x4350000000000002L, "18014398509481990")] // even significand: ...990 on the lower bound, included
        [InlineData(0x4350000000000007L, "18014398509482012")] // odd significand: ...010 on the lower bound, excluded
        public void MatchesJavaScriptStringAtBoundaries(long bits, string expected)
        {
            Assert.Equal(expected, JsNumber.ToString(BitConverter.Int64BitsToDouble(bits)));
        }

        [Fact]
        public void NegativeZeroIsZero()
        {
            // xUnit treats InlineData(0.0) and InlineData(-0.0) as duplicates, hence a separate test.
            Assert.Equal("0", JsNumber.ToString(-0.0));
        }

        [Fact]
        public void NonFiniteValuesAreSpelledLikeJavaScript()
        {
            Assert.Equal("NaN", JsNumber.ToString(double.NaN));
            Assert.Equal("Infinity", JsNumber.ToString(double.PositiveInfinity));
            Assert.Equal("-Infinity", JsNumber.ToString(double.NegativeInfinity));
        }
    }
}

using System.Text.Json.Nodes;
using Xunit;

namespace TingQR.Tests.Conformance
{
    public class JsonInputTests
    {
        private static JsonInput Of(string json) => JsonInput.Of(JsonNode.Parse(json));

        [Theory]
        [InlineData("1e400")]
        [InlineData("-1e400")]
        public void DoubleOutOfRangeIsAnInputError(string number)
        {
            var e = Assert.Throws<InputConversionException>(() => Of("{\"size\":" + number + "}").Double("size"));
            Assert.Contains("input.size", e.Message);
        }

        [Theory]
        [InlineData("0.25", 0.25)]
        [InlineData("1e21", 1e21)]
        [InlineData("-0", -0.0)]
        [InlineData("1.7976931348623157e308", double.MaxValue)]
        [InlineData("5e-324", double.Epsilon)]
        public void DoubleReadsFiniteNumbers(string number, double expected)
            => Assert.Equal(expected, Of("{\"size\":" + number + "}").Double("size"));

        [Fact]
        public void DoubleRejectsAStringAndIsNullWhenAbsent()
        {
            Assert.Throws<InputConversionException>(() => Of("{\"size\":\"1\"}").Double("size"));
            Assert.Null(Of("{}").Double("size"));
        }
    }
}

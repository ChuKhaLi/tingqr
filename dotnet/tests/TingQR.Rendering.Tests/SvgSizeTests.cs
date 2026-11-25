using System;
using Xunit;

namespace TingQR.Rendering.Tests
{
    /// <summary>Value equality of <see cref="SvgSize"/>: same form and same value (pixels by double ==, lengths ordinal).</summary>
    public class SvgSizeTests
    {
        [Fact]
        public void EqualWhenSameFormAndValue()
        {
            Assert.True(new SvgSize(300).Equals(new SvgSize(300)));
            Assert.True(new SvgSize("40mm").Equals(new SvgSize("40mm")));
            Assert.True(((SvgSize)300) == (SvgSize)300.0);
            Assert.True(((SvgSize)"40mm") == (SvgSize)"40mm");
            Assert.False(((SvgSize)"40mm") != (SvgSize)"40mm");
            Assert.True(default(SvgSize) == new SvgSize(0));
            Assert.True(new SvgSize((string?)null) == new SvgSize((string?)null));
            Assert.Equal(new SvgSize(2.5), new SvgSize(2.5));
        }

        [Fact]
        public void DifferentWhenValueOrFormDiffers()
        {
            Assert.False(new SvgSize(300).Equals(new SvgSize(301)));
            Assert.True(((SvgSize)300) != (SvgSize)301);
            Assert.False(((SvgSize)300) == (SvgSize)301);
            Assert.False(new SvgSize("40mm").Equals(new SvgSize("40MM")));
            Assert.False(new SvgSize("40mm").Equals(new SvgSize("41mm")));
            // Same text, different form: 40 px is not the length "40".
            Assert.False(new SvgSize(40).Equals(new SvgSize("40")));
            Assert.False(new SvgSize("40").Equals(new SvgSize(40)));
            // Pixels 0 and a null length differ only in form.
            Assert.False(new SvgSize(0).Equals(new SvgSize((string?)null)));
            Assert.False(new SvgSize((string?)null).Equals(new SvgSize("")));
        }

        [Fact]
        public void PixelsCompareWithDoubleEquality()
        {
            Assert.True(new SvgSize(0.0) == new SvgSize(-0.0));
            Assert.False(new SvgSize(double.NaN) == new SvgSize(double.NaN));
            Assert.False(new SvgSize(double.NaN).Equals(new SvgSize(double.NaN)));
            Assert.True(new SvgSize(double.PositiveInfinity) == new SvgSize(double.PositiveInfinity));
        }

        [Fact]
        public void EqualsObject()
        {
            Assert.True(new SvgSize(300).Equals((object)new SvgSize(300)));
            Assert.False(new SvgSize(300).Equals((object)new SvgSize(301)));
            Assert.False(new SvgSize(300).Equals((object)300.0));
            Assert.False(new SvgSize("40mm").Equals((object)"40mm"));
            Assert.False(new SvgSize(300).Equals(null));
        }

        [Fact]
        public void HashFollowsEquality()
        {
            Assert.Equal(new SvgSize(300).GetHashCode(), new SvgSize(300).GetHashCode());
            Assert.Equal(new SvgSize("40mm").GetHashCode(), new SvgSize("40mm").GetHashCode());
            Assert.Equal(new SvgSize(0.0).GetHashCode(), new SvgSize(-0.0).GetHashCode());
            Assert.Equal(new SvgSize((string?)null).GetHashCode(), new SvgSize((string?)null).GetHashCode());
            Assert.NotEqual(new SvgSize(300).GetHashCode(), new SvgSize(301).GetHashCode());
            Assert.NotEqual(new SvgSize("40mm").GetHashCode(), new SvgSize("41mm").GetHashCode());
            Assert.NotEqual(new SvgSize(0).GetHashCode(), new SvgSize("40mm").GetHashCode());
            Assert.NotEqual(new SvgSize(0).GetHashCode(), new SvgSize((string?)null).GetHashCode());
        }
    }
}

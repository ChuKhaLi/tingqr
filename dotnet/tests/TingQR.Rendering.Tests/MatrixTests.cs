using System;
using System.Collections.Generic;
using Xunit;

namespace TingQR.Rendering.Tests
{
    public class MatrixTests
    {
        [Fact]
        public void NullTextIsInvalidValue()
        {
            var e = Assert.Throws<TingQrException>(() => TingQrRender.ToMatrix(null));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        }

        // 2 953 bytes is version 40-L's byte-mode capacity: 4 + 16 + 2953 × 8 = 23 644 bits ≤ 2 956 × 8.
        // Lower-case letters are not alphanumeric-mode characters, so the text goes in byte mode.
        [Fact]
        public void LongestByteTextAtEccLFitsVersion40()
        {
            var m = TingQrRender.ToMatrix(new string('a', 2953), new MatrixOptions { Ecc = Ecc.L });
            Assert.Equal(40, m.Version);
            Assert.Equal(177, m.Size);
            Assert.Equal(Ecc.L, m.Ecc);
        }

        [Fact]
        public void OneByteMoreIsTooLong()
        {
            var e = Assert.Throws<TingQrException>(
                () => TingQrRender.ToMatrix(new string('a', 2954), new MatrixOptions { Ecc = Ecc.L }));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            Assert.Contains("too long", e.Message, StringComparison.Ordinal);
        }

        [Fact]
        public void TooLongForMaxVersionIsInvalidValue()
        {
            var e = Assert.Throws<TingQrException>(
                () => TingQrRender.ToMatrix(new string('a', 100), new MatrixOptions { MaxVersion = 2 }));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            Assert.Contains("too long", e.Message, StringComparison.Ordinal);
        }

        [Fact]
        public void ModulesAreReadOnly()
        {
            var m = TingQrRender.ToMatrix("A");
            var before = m.IsDark(0, 0);
            Assert.False(m.Modules is bool[][]);
            Assert.False(m.Modules[0] is bool[]);
            if (m.Modules is IList<IReadOnlyList<bool>> rows)
            {
                Assert.Throws<NotSupportedException>(() => rows[0] = new bool[m.Size]);
            }
            if (m.Modules[0] is IList<bool> row)
            {
                Assert.Throws<NotSupportedException>(() => row[0] = !before);
            }
            Assert.Equal(before, m.IsDark(0, 0));
            Assert.Equal(before, m.Modules[0][0]);
        }

        [Fact]
        public void IsDarkMatchesModulesAndIsLightOutside()
        {
            var m = TingQrRender.ToMatrix("A");
            for (var y = 0; y < m.Size; y++)
            {
                for (var x = 0; x < m.Size; x++)
                {
                    Assert.Equal(m.Modules[y][x], m.IsDark(x, y));
                }
            }
            Assert.True(m.IsDark(0, 0)); // finder pattern corner
            Assert.False(m.IsDark(-1, 0));
            Assert.False(m.IsDark(0, -1));
            Assert.False(m.IsDark(m.Size, 0));
            Assert.False(m.IsDark(0, m.Size));
        }

        [Fact]
        public void NullOptionsAreDefaults()
        {
            var m = TingQrRender.ToMatrix("A", null);
            var d = TingQrRender.ToMatrix("A", new MatrixOptions());
            Assert.Equal(1, m.Version);
            Assert.Equal(d.Mask, m.Mask);
            Assert.Equal(d.Ecc, m.Ecc);
        }
    }
}

using System;
using System.Collections.Generic;
using System.Text;
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

        // 7089 digits is the largest QR code there is: numeric mode, version 40, ECC L (4 + 14 + 2363 × 10 = 23 648 bits).
        [Fact]
        public void LongestNumericTextFitsVersion40AtEccL()
        {
            var m = TingQrRender.ToMatrix(new string('1', 7089), new MatrixOptions { Ecc = Ecc.L });
            Assert.Equal(40, m.Version);
            Assert.Equal(Ecc.L, m.Ecc);
        }

        public static IEnumerable<object[]> OverlongTexts()
        {
            yield return new object[] { "7090 digits", new string('1', 7090) };
            yield return new object[] { "1 000 000 ASCII letters", new string('a', 1000000) };
            var emoji = new StringBuilder(1000000);
            for (var i = 0; i < 500000; i++) emoji.Append("😀");
            yield return new object[] { "500 000 emoji (1 000 000 UTF-16 units)", emoji.ToString() };
        }

        [Theory]
        [MemberData(nameof(OverlongTexts))]
        public void TextLongerThanAnyQrCodeIsRejectedBeforeTheEncoderAllocates(string name, string text)
        {
            _ = name;
            var options = new MatrixOptions { Ecc = Ecc.L };
            TingQrRender.ToMatrix("warm up", options); // JIT and static tables are not part of the measurement
#if NET
            var before = GC.GetAllocatedBytesForCurrentThread();
#endif
            var e = Assert.Throws<TingQrException>(() => TingQrRender.ToMatrix(text, options));
#if NET
            var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
            // Before the early check existed this measured 435 488 bytes (7090 digits), 108 501 464 (letters) and
            // 216 999 384 (emoji) on net10.0, Windows, 2026-11-25; the early rejection allocates the exception only.
            Assert.True(allocated < 32 * 1024, $"allocated {allocated} bytes");
#endif
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            Assert.Equal("Text is too long for a QR code of version ≤ 40 at ECC L.", e.Message);
        }

        [Fact]
        public void ModulesAreReadOnly()
        {
            var m = TingQrRender.ToMatrix("A");
            var before = m.IsDark(0, 0);
            Assert.False(m.Modules is bool[][]);
            Assert.False(m.Modules[0] is bool[]);
            // Array.AsReadOnly wrappers implement IList but throw on every write; asserted unconditionally.
            var rows = Assert.IsAssignableFrom<IList<IReadOnlyList<bool>>>(m.Modules);
            Assert.Throws<NotSupportedException>(() => rows[0] = new bool[m.Size]);
            var row = Assert.IsAssignableFrom<IList<bool>>(m.Modules[0]);
            Assert.Throws<NotSupportedException>(() => row[0] = !before);
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

        // Messages from the built TS dist (node 22): toMatrix('A', options) for each options object below.
        public static IEnumerable<object[]> BadIntOptions() => new[]
        {
            new object[] { new MatrixOptions { Mask = 8 }, "Option mask must be an integer 0–7." },
            new object[] { new MatrixOptions { Mask = -1 }, "Option mask must be an integer 0–7." },
            new object[] { new MatrixOptions { MinVersion = 0 }, "Option minVersion must be an integer 1–40." },
            new object[] { new MatrixOptions { MinVersion = 41 }, "Option minVersion must be an integer 1–40." },
            new object[] { new MatrixOptions { MaxVersion = 0 }, "Option maxVersion must be an integer 1–40." },
            new object[] { new MatrixOptions { MaxVersion = 41 }, "Option maxVersion must be an integer 1–40." },
            new object[] { new MatrixOptions { MinVersion = 5, MaxVersion = 4 }, "Option minVersion must not exceed maxVersion." },
        };

        [Theory]
        [MemberData(nameof(BadIntOptions))]
        public void BadIntOptionMessages(MatrixOptions options, string message)
        {
            var e = Assert.Throws<TingQrException>(() => TingQrRender.ToMatrix("A", options));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            Assert.Equal(message, e.Message);
        }

        // node: toMatrix('A', { minVersion: 5, maxVersion: 5 }) gives version 5, size 37.
        [Fact]
        public void EqualMinAndMaxVersionPinTheVersion()
        {
            var m = TingQrRender.ToMatrix("A", new MatrixOptions { MinVersion = 5, MaxVersion = 5 });
            Assert.Equal(5, m.Version);
            Assert.Equal(37, m.Size);
        }

        // node: toMatrix throws INVALID_VALUE with this message for each text below, and encodes '😀' (version 1).
        // One Fact, not InlineData: xUnit's test-case serialisation replaces lone surrogates with U+FFFD.
        [Fact]
        public void LoneSurrogatesAreInvalidValue()
        {
            foreach (var text in new[] { "\uD800", "a\uD800", "\uD800a", "\uDC00", "a\uDC00b" })
            {
                var e = Assert.Throws<TingQrException>(() => TingQrRender.ToMatrix(text));
                Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
                Assert.Equal("Text contains an unpaired surrogate (a character cut in half); it cannot be encoded as UTF-8.", e.Message);
            }
        }

        [Fact]
        public void ASurrogatePairIsEncoded()
        {
            Assert.Equal(1, TingQrRender.ToMatrix("😀").Version);
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

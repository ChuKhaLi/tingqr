using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using TingQR;
using Xunit;

namespace TingQR.Tests
{
    public class ErrorCodeTests
    {
        private static List<string> CodesIn(string section)
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(ConformanceRoot.Path, "errors.json")));
            return doc.RootElement.GetProperty(section).EnumerateArray()
                .Select(e => e.GetProperty("code").GetString()!).ToList();
        }

        [Fact]
        public void ErrorCodesMatchErrorsJson()
        {
            var names = Enum.GetValues(typeof(TingQrErrorCode)).Cast<TingQrErrorCode>().Select(c => c.ToWireName()).ToList();
            Assert.Equal(CodesIn("errors"), names);
        }

        [Fact]
        public void WarningCodesMatchErrorsJson()
        {
            var names = Enum.GetValues(typeof(TingQrWarningCode)).Cast<TingQrWarningCode>().Select(c => c.ToWireName()).ToList();
            Assert.Equal(CodesIn("warnings"), names);
        }

        [Fact]
        public void ResultSuccessHasNoError()
        {
            var r = TingQrResult<string>.Success("x", new[] { new TingQrWarning(TingQrWarningCode.LowercaseCrc, "m") });
            Assert.True(r.Ok);
            Assert.Equal("x", r.Value);
            Assert.Null(r.Error);
            Assert.Single(r.Warnings);
        }

        [Fact]
        public void ResultFailureHasNoValue()
        {
            var e = new TingQrException(TingQrErrorCode.BadTag, "bad", "ab");
            var r = TingQrResult<string>.Failure(e);
            Assert.False(r.Ok);
            Assert.Null(r.Value);
            Assert.Same(e, r.Error);
            Assert.Empty(r.Warnings);
            Assert.Equal("ab", e.Tag);
        }
    }
}

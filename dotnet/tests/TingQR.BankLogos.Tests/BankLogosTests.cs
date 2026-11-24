using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using TingQR.Rendering;
using Xunit;

namespace TingQR.Tests
{
    public class BankLogosTests
    {
        private sealed class Entry
        {
            public Entry(string file, string kind, string key, string sha256)
            {
                File = file;
                Kind = kind;
                Key = key;
                Sha256 = sha256;
            }

            public string File { get; }
            public string Kind { get; }
            public string Key { get; }
            public string Sha256 { get; }
        }

        private static readonly string LogosDir = Path.Combine(ConformanceRoot.Path, "banks", "logos");

        private static readonly List<Entry> Manifest = Load();

        private static List<Entry> Load()
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(LogosDir, "manifest.json")));
            return doc.RootElement.GetProperty("files").EnumerateArray()
                .Select(e => new Entry(
                    e.GetProperty("file").GetString()!,
                    e.GetProperty("kind").GetString()!,
                    e.GetProperty("key").GetString()!,
                    e.GetProperty("sha256").GetString()!))
                .ToList();
        }

        public static IEnumerable<object[]> Entries() => Manifest.Select(e => new object[] { e.File, e.Kind, e.Key, e.Sha256 });

        private static string? Uri(string kind, string key) => kind == "logo" ? BankLogos.Logo(key) : BankLogos.Icon(key);

        private static BankLogoFile? Open(string kind, string key) => kind == "logo" ? BankLogos.OpenLogo(key) : BankLogos.OpenIcon(key);

        private static string[] Keys(string kind) => Manifest.Where(e => e.Kind == kind).Select(e => e.Key).OrderBy(k => k, StringComparer.Ordinal).ToArray();

        [Fact]
        public void Lists_match_manifest()
        {
            Assert.Equal(Keys("logo"), BankLogos.LogoBins);
            Assert.Equal(Keys("icon"), BankLogos.IconIds);
        }

        [Theory]
        [MemberData(nameof(Entries))]
        public void Every_data_uri_decodes_to_the_conformance_file_byte_for_byte(string file, string kind, string key, string sha256)
        {
            var expected = File.ReadAllBytes(Path.Combine(LogosDir, file.Replace('/', Path.DirectorySeparatorChar)));
            var prefix = file.EndsWith(".svg", StringComparison.Ordinal) ? "data:image/svg+xml;base64," : "data:image/webp;base64,";
            var uri = Uri(kind, key);
            Assert.NotNull(uri);
            Assert.StartsWith(prefix, uri, StringComparison.Ordinal);
            var bytes = Convert.FromBase64String(uri!.Substring(prefix.Length));
            Assert.Equal(expected, bytes);
            using var sha = SHA256.Create();
            Assert.Equal(sha256, BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant());
        }

        [Theory]
        [MemberData(nameof(Entries))]
        public void Open_returns_stream_with_same_bytes_and_content_type(string file, string kind, string key, string sha256)
        {
            _ = sha256;
            var expected = File.ReadAllBytes(Path.Combine(LogosDir, file.Replace('/', Path.DirectorySeparatorChar)));
            using var opened = Open(kind, key);
            Assert.NotNull(opened);
            Assert.Equal(file.EndsWith(".svg", StringComparison.Ordinal) ? "image/svg+xml" : "image/webp", opened!.ContentType);
            Assert.Equal(file.Substring(file.IndexOf('/') + 1), opened.FileName);
            using var ms = new MemoryStream();
            opened.Content.CopyTo(ms);
            Assert.Equal(expected, ms.ToArray());
        }

        [Fact]
        public void Unknown_returns_null()
        {
            foreach (var key in new[] { "000000", "nope" })
            {
                Assert.Null(BankLogos.Logo(key));
                Assert.Null(BankLogos.Icon(key));
                Assert.Null(BankLogos.OpenLogo(key));
                Assert.Null(BankLogos.OpenIcon(key));
            }
        }

        [Fact]
        public void Lookup_is_exact()
        {
            Assert.NotNull(BankLogos.Logo("970418"));
            Assert.Null(BankLogos.Logo(" 970418"));
            Assert.Null(BankLogos.Logo("970418 "));
            Assert.NotNull(BankLogos.Icon("mb"));
            Assert.Null(BankLogos.Icon("MB"));
            Assert.Null(BankLogos.OpenIcon("MB"));
        }

        [Fact]
        public void Null_throws_ArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() => BankLogos.Logo(null!));
            Assert.Throws<ArgumentNullException>(() => BankLogos.Icon(null!));
            Assert.Throws<ArgumentNullException>(() => BankLogos.OpenLogo(null!));
            Assert.Throws<ArgumentNullException>(() => BankLogos.OpenIcon(null!));
        }

        [Fact]
        public void Data_uri_is_cached()
        {
            Assert.Same(BankLogos.Icon("mb"), BankLogos.Icon("mb"));
            Assert.Same(BankLogos.Logo("970418"), BankLogos.Logo("970418"));
        }

        [Fact]
        public void Logo_works_as_svg_logo()
        {
            const string payload = "00020101021138540010A00000072701240006970422011001234567890208QRIBFTTA53037045802VN6304B1A7";
            var svg = TingQrRender.ToSvg(payload, new SvgOptions { Logo = new LogoOptions { Href = BankLogos.Icon("mb")! } });
            Assert.Contains("data:image/webp;base64,", svg);
        }
    }
}

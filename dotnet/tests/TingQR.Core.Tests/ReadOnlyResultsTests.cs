using System;
using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    /// <summary>
    /// Lists and dictionaries the library hands out cannot be changed by casting them back to a mutable interface.
    /// </summary>
    public class ReadOnlyResultsTests
    {
        // vietnam-qr-pay README (MIT) VietQR and VNPAY samples; promptparse@1.7.1 (MIT) PromptPay mobile;
        // bakong-khqr@1.0.20 test (ISC) KHQR individual (same samples as the scheme tests).
        private const string VietQrSample = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";
        private const string VnpaySample =
            "00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685";
        private const string PromptPaySample = "00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF";
        private const string KhqrIndividual =
            "00020101021229460015john_smith@devb0111855122334550208Dev Bank52045999530384054031005802KH5910John Smith6010PHNOM PENH62670106#123450211855122334550311Coffee Shop0709Cashier_10810Buy coffee64280002km0108ចន ស្មីន0206ភ្នំពញ993400131726821915797011317268220357976304B73E";

        internal static void AssertFrozen<T>(IReadOnlyList<T> list)
        {
            Assert.NotEmpty(list);
            var mutable = Assert.IsAssignableFrom<IList<T>>(list);
            Assert.Throws<NotSupportedException>(() => mutable.Add(list[0]));
            Assert.Throws<NotSupportedException>(() => mutable[0] = list[0]);
            Assert.Throws<NotSupportedException>(() => mutable.Clear());
        }

        private static void AssertFrozen(IReadOnlyDictionary<string, string>? dictionary)
        {
            Assert.NotNull(dictionary);
            Assert.NotEmpty(dictionary!);
            var mutable = Assert.IsAssignableFrom<IDictionary<string, string>>(dictionary);
            var first = dictionary!.First();
            Assert.Throws<NotSupportedException>(() => mutable[first.Key] = "changed");
            Assert.Throws<NotSupportedException>(() => mutable.Add("zz", "x"));
            Assert.Throws<NotSupportedException>(() => mutable.Remove(first.Key));
        }

        // The VietQR sample with an uninterpreted top-level tag (80) and tag 62, rebuilt with a valid CRC.
        private static string VietQrWithExtras()
        {
            var fields = EmvPayload.Parse(VietQrSample).Value!.Fields
                .Where(f => f.Tag != "63").Select(f => new TlvField(f.Tag, f.Value)).ToList();
            fields.Add(new TlvField("80", "X"));
            fields.Add(new TlvField("62", Tlv.Field("08", "TEST")));
            return EmvPayload.Build(fields);
        }

        [Fact]
        public void ResultWarnings()
        {
            var r = VietQr.Decode(" " + VietQrSample);
            Assert.True(r.Ok);
            AssertFrozen(r.Warnings);
            AssertFrozen(EmvPayload.Parse(" " + VietQrSample).Warnings);
            AssertFrozen(TingQrDetector.Detect(" " + VietQrSample).Warnings);
        }

        [Fact]
        public void ResultWarningsCannotBeChangedThroughTheListPassedIn()
        {
            var source = new List<TingQrWarning> { new TingQrWarning(TingQrWarningCode.TrimmedWhitespace, "x") };
            var r = TingQrResult<string>.Success("v", source);
            source.Add(new TingQrWarning(TingQrWarningCode.LowercaseCrc, "y"));
            Assert.Single(r.Warnings);
            AssertFrozen(r.Warnings);
        }

        [Fact]
        public void FailedResultWarningsAreEmptyAndReadOnly()
        {
            var w = VietQr.Decode("nope").Warnings;
            Assert.Empty(w);
            Assert.Throws<NotSupportedException>(() => ((IList<TingQrWarning>)w).Add(new TingQrWarning(TingQrWarningCode.LowercaseCrc, "y")));
        }

        [Fact]
        public void PayloadFieldsAndTlvParse()
        {
            AssertFrozen(EmvPayload.Parse(VietQrSample).Value!.Fields);
            AssertFrozen(Tlv.Parse(VietQrSample));
            AssertFrozen(Tlv.ParseTemplate(Tlv.Field("00", "A") + Tlv.Field("01", "B")));
        }

        [Fact]
        public void PayloadFieldsCannotBeChangedThroughTheListPassedIn()
        {
            var source = new List<TlvNode> { new TlvNode("00", "01") };
            var p = new EmvPayload(source, "ABCD", "raw");
            source.Add(new TlvNode("01", "11"));
            Assert.Single(p.Fields);
            AssertFrozen(p.Fields);
        }

        [Fact]
        public void NodeChildren()
        {
            var source = new List<TlvNode> { new TlvNode("00", "A") };
            var node = new TlvNode("38", "x", source);
            source.Add(new TlvNode("01", "B"));
            Assert.Single(node.Children!);
            AssertFrozen(node.Children!);

            var copy = node with { Children = new List<TlvNode> { new TlvNode("02", "C") } };
            AssertFrozen(copy.Children!);
            Assert.Null((node with { Children = null }).Children);
            Assert.Null(new TlvNode("38", "x").Children);
        }

        [Fact]
        public void ExceptionFields()
        {
            var r = TingQrDetector.Detect(EmvPayload.Build(new[] { new TlvField("00", "01") }));
            Assert.Equal(TingQrErrorCode.UnknownScheme, r.Error!.Code);
            AssertFrozen(r.Error.Fields!);

            var source = new List<TlvNode> { new TlvNode("00", "01") };
            var e = new TingQrException(TingQrErrorCode.UnknownScheme, "m", null, source);
            source.Add(new TlvNode("01", "11"));
            Assert.Single(e.Fields!);
            AssertFrozen(e.Fields!);
            Assert.Null(new TingQrException(TingQrErrorCode.UnknownScheme, "m").Fields);
        }

        [Fact]
        public void DetectAlsoMatches()
        {
            // The VNPAY sample with the VietQR tag 38 added is recognised as VietQR and also as VNPAY.
            var fields = EmvPayload.Parse(VnpaySample).Value!.Fields
                .Where(f => f.Tag != "63").Select(f => new TlvField(f.Tag, f.Value)).ToList();
            fields.Add(new TlvField("38", EmvPayload.Parse(VietQrSample).Value!.GetField("38")!.Value));
            var r = TingQrDetector.Detect(EmvPayload.Build(fields.OrderBy(f => f.Tag, StringComparer.Ordinal)));
            Assert.True(r.Ok);
            Assert.Equal(QrScheme.VietQr, r.Value!.Scheme);
            AssertFrozen(r.Value.AlsoMatches);
        }

        [Fact]
        public void BankLists()
        {
            AssertFrozen(Banks.All);
            AssertFrozen(BankApps.All);
            AssertFrozen(BankApps.ForBank(BankApps.All.First(a => a.Bin != null).Bin!));
        }

        [Fact]
        public void DecodedDictionaries()
        {
            var v = VietQr.Decode(VietQrWithExtras()).Value!;
            AssertFrozen(v.AdditionalData);
            AssertFrozen(v.ExtraFields);

            var n = VnpayQr.Decode(VnpaySample).Value!;
            AssertFrozen(n.AdditionalData);
            // The sample's tag 26 has only sub-tags 00 and 01; add a provider sub-tag 02.
            var withProvider = EmvPayload.Parse(VnpaySample).Value!.Fields
                .Where(f => f.Tag != "63")
                .Select(f => f.Tag == "26" ? new TlvField("26", f.Value + Tlv.Field("02", "X")) : new TlvField(f.Tag, f.Value));
            AssertFrozen(VnpayQr.Decode(EmvPayload.Build(withProvider)).Value!.ProviderData);

            var p = PromptPayQr.Decode(PromptPaySample).Value!;
            AssertFrozen(p.SubFields);

            var k = Khqr.Decode(KhqrIndividual).Value!;
            AssertFrozen(k.AdditionalData);
            AssertFrozen(k.Timestamp);
        }

        [Fact]
        public void DecodedExtraFieldsOfOtherSchemes()
        {
            string WithExtra(string payload)
            {
                var fields = EmvPayload.Parse(payload).Value!.Fields
                    .Where(f => f.Tag != "63").Select(f => new TlvField(f.Tag, f.Value)).ToList();
                fields.Add(new TlvField("80", "X"));
                return EmvPayload.Build(fields);
            }
            AssertFrozen(VnpayQr.Decode(WithExtra(VnpaySample)).Value!.ExtraFields);
            AssertFrozen(PromptPayQr.Decode(WithExtra(PromptPaySample)).Value!.ExtraFields);
            AssertFrozen(Khqr.Decode(WithExtra(KhqrIndividual)).Value!.ExtraFields);
        }
    }
}

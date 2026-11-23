using System;
using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;

namespace TingQR
{
    /// <summary>Thai PromptPay payloads: <c>encodePromptPayQr</c>/<c>decodePromptPayQr</c> of the TypeScript package.</summary>
    public static class PromptPayQr
    {
        /// <summary>PromptPay AIDs in sub-tag 00 of tag 29 (credit transfer) or tag 30 (bill payment).</summary>
        public static class Aid
        {
            /// <summary>Credit transfer (tag 29).</summary>
            public const string CreditTransfer = "A000000677010111";

            /// <summary>Credit transfer with an OTA code (tag 29).</summary>
            public const string Ota = "A000000677010114";

            /// <summary>Bill payment (tag 30).</summary>
            public const string BillPayment = "A000000677010112";

            /// <summary>Cross-border bill payment (tag 30).</summary>
            public const string BillPaymentCrossBorder = "A000000677012006";
        }

        private static readonly (string Sub, PromptPayProxyType Type)[] ProxySubTags =
        {
            ("01", PromptPayProxyType.Mobile),
            ("02", PromptPayProxyType.NationalId),
            ("03", PromptPayProxyType.EWallet),
            ("04", PromptPayProxyType.BankAccount),
        };

        // Character tests instead of Regex: .NET's \d matches every Unicode digit and its $ matches before a final \n.
        private static bool IsAsciiDigit(char c) => c >= '0' && c <= '9';

        private static bool AllDigits(string s) => s.All(IsAsciiDigit);

        private static TingQrException Invalid(string message, string tag) => new TingQrException(TingQrErrorCode.InvalidValue, message, tag);

        // Stryker disable once all : Quote only formats error messages
        private static string Quote(string? s) => s == null ? "null" : "\"" + s + "\"";

        private static string Digits(string? value, int[] lengths, string what, string tag)
        {
            if (value == null || value.Length == 0 || !AllDigits(value) || !lengths.Contains(value.Length))
            {
                throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"{what} {Quote(value)} must be {string.Join(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    " or ", lengths)} digits.", tag);
            }
            return value;
        }

        private static string? Reference(string? value, string name, string tag)
        {
            if (string.IsNullOrEmpty(value)) return null;
            if (!VietQr.IsPrintableAscii(value!)) throw new TingQrException(TingQrErrorCode.NonAscii,
                // Stryker disable once String : error message, or a field name that only appears in one
                $"{name} must be printable ASCII.", tag);
            if (value!.Length > 20) throw Invalid(
                // Stryker disable once String : error message, or a field name that only appears in one
                $"{name} is {value.Length} characters; the maximum is 20.", tag);
            return value;
        }

        // Tag 54 text: two decimals, no float arithmetic. Null for no amount.
        private static string? AmountText(QrAmount? amount)
        {
            if (amount == null || !amount.Value.HasValue) return null;
            var text = amount.Value.Text!;
            var dot = text.IndexOf('.');
            var whole = dot == -1 ? text : text.Substring(0, dot);
            var frac = dot == -1 ? string.Empty : text.Substring(dot + 1);
            // ^(\d{1,10})(?:\.(\d{1,2}))?$
            var shape = whole.Length >= 1 && whole.Length <= 10 && AllDigits(whole)
                && (dot == -1 || (frac.Length >= 1 && frac.Length <= 2 && AllDigits(frac)));
            if (shape)
            {
                var trimmed = whole.TrimStart('0');
                whole = trimmed.Length == 0 ? "0" : trimmed;
            }
            var cents = frac.PadRight(2, '0');
            if (!shape || (whole == "0" && cents == "00"))
            {
                // Stryker disable once all : "shown" is only used in the error message
                var shown = amount.Value.IsNumber ? text : Quote(text);
                throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"Amount {shown} must be greater than zero, at most 9999999999.99, with at most 2 decimals.", "54");
            }
            return whole + "." + cents;
        }

        private static (string Tag, string Value) MerchantTemplate(PromptPayTarget? target)
        {
            switch (target)
            {
                case PromptPayTarget.Mobile m:
                {
                    // Stryker disable once String : a null Number and "Stryker was here!" both leave no digits
                    var raw = new string((m.Number ?? string.Empty).Where(IsAsciiDigit).ToArray());
                    string? national = null;
                    if (raw.Length == 10 && raw[0] == '0') national = raw.Substring(1);
                    else if (raw.Length == 11 && raw.StartsWith("66", StringComparison.Ordinal)) national = raw.Substring(2);
                    else if (raw.Length == 13 && raw.StartsWith("0066", StringComparison.Ordinal)) national = raw.Substring(4);
                    if (national == null)
                    {
                        throw Invalid(
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Mobile {Quote(m.Number)} must be a Thai number: 0, 66 or 0066 + 9 digits.", "29.01");
                    }
                    return ("29", Tlv.Field("00", Aid.CreditTransfer) + Tlv.Field("01", "0066" + national));
                }
                case PromptPayTarget.NationalId n:
                    return ("29", Tlv.Field("00", Aid.CreditTransfer) + Tlv.Field("02", Digits(n.Id, new[] { 13 },
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "National or tax ID", "29.02")));
                case PromptPayTarget.EWallet w:
                    return ("29", Tlv.Field("00", Aid.CreditTransfer) + Tlv.Field("03", Digits(w.Id, new[] { 15 },
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "E-wallet ID", "29.03")));
                case PromptPayTarget.Bill b:
                {
                    var biller = Digits(b.BillerId, new[] { 13, 15 },
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Biller ID", "30.01");
                    var ref1 = Reference(b.Reference1,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "reference1", "30.02");
                    var ref2 = Reference(b.Reference2,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "reference2", "30.03");
                    var value = Tlv.Field("00", Aid.BillPayment) + Tlv.Field("01", biller);
                    if (ref1 != null) value += Tlv.Field("02", ref1);
                    if (ref2 != null) value += Tlv.Field("03", ref2);
                    return ("30", value);
                }
                default:
                    throw Invalid(
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Target must be Mobile, NationalId, EWallet or Bill.", "29");
            }
        }

        /// <summary>
        /// Builds a Thai PromptPay payload. Tags are written in ascending order (00, 01, 29/30, 53, 54, 58, 63).
        /// Throws <see cref="TingQrException"/> on invalid input (including null); never rounds or silently changes it.
        /// </summary>
        public static string Encode(PromptPayInput? input)
        {
            if (input == null)
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "PromptPayQr.Encode needs an input object; got null.");
            }
            var (tag, merchant) = MerchantTemplate(input.Target);
            var amount = AmountText(input.Amount);
            var fields = new List<TlvField>
            {
                new TlvField("00", "01"),
                new TlvField("01", amount != null ? "12" : "11"),
                new TlvField(tag, merchant),
                new TlvField("53", "764"),
            };
            if (amount != null) fields.Add(new TlvField("54", amount));
            fields.Add(new TlvField("58", "TH"));
            return EmvPayloads.Build(fields);
        }

        /// <summary>
        /// Reads a Thai PromptPay payload: credit transfer (tag 29) or bill payment (tag 30). Lenient mode (default)
        /// fills tags 53/58 when missing and accepts a tag 29 without a proxy, reporting each in the warnings;
        /// <see cref="ParseMode.Strict"/> rejects them instead. TrueMoney and other e-wallets are returned as
        /// <see cref="PromptPayProxyType.EWallet"/> without a provider label. Never throws on bad data, including null.
        /// </summary>
        public static TingQrResult<PromptPayData> Decode(string? payload, ParseMode mode = ParseMode.Lenient)
        {
            var parsed = EmvPayloads.Parse(payload);
            if (!parsed.Ok) return TingQrResult<PromptPayData>.Failure(parsed.Error!);
            return Read(parsed.Value!, parsed.Warnings, mode);
        }

        private static TingQrResult<PromptPayData> Fail(TingQrErrorCode code, string message, string tag)
            => TingQrResult<PromptPayData>.Failure(new TingQrException(code, message, tag));

        private static Dictionary<string, string> SubFieldsOf(IReadOnlyList<TlvNode> nodes)
            => nodes.Where(n => n.Tag != "00").ToDictionary(n => n.Tag, n => n.Value);

        private static string? Sub(IReadOnlyList<TlvNode> nodes, string tag) => nodes.FirstOrDefault(n => n.Tag == tag)?.Value;

        // The first of the given AIDs whose template is present in the tag, with its sub-fields.
        private static (string Aid, IReadOnlyList<TlvNode> Nodes)? FindTemplate(EmvPayload p, string tag, params string[] aids)
        {
            foreach (var aid in aids)
            {
                var nodes = Fields.ReadSchemeTemplate(p, tag, aid);
                if (nodes != null) return (aid, nodes);
            }
            return null;
        }

        /// <summary><see cref="Decode"/> on a payload already parsed by <see cref="EmvPayloads.Parse"/>.</summary>
        internal static TingQrResult<PromptPayData> Read(EmvPayload p, IReadOnlyList<TingQrWarning> parsedWarnings, ParseMode mode)
        {
            var warnings = new List<TingQrWarning>(parsedWarnings);
            try
            {
                var transfer = FindTemplate(p, "29", Aid.CreditTransfer, Aid.Ota);
                var bill = transfer != null ? null : FindTemplate(p, "30", Aid.BillPayment, Aid.BillPaymentCrossBorder);
                string merchantTag;
                PromptPayKind kind;
                bool? ota = null;
                PromptPayProxyType? proxyType = null;
                string? proxy = null, mobile = null, otaCode = null;
                bool? crossBorder = null;
                string? billerId = null, ref1 = null, ref2 = null;
                IReadOnlyDictionary<string, string> subFields;

                if (transfer != null)
                {
                    var (aid, nodes) = transfer.Value;
                    merchantTag = "29";
                    kind = PromptPayKind.CreditTransfer;
                    var first = ProxySubTags
                        .Select(s => (Value: Sub(nodes, s.Sub), s.Type))
                        .FirstOrDefault(x => x.Value != null);
                    if (first.Value == null)
                    {
                        if (mode == ParseMode.Strict) return Fail(TingQrErrorCode.MissingTag,
                            // Stryker disable once String : error message, or a field name that only appears in one
                            "Tag 29 has no proxy (sub-tags 01-04).", "29.01");
                        warnings.Add(new TingQrWarning(TingQrWarningCode.MissingOptionalTag,
                            // Stryker disable once String : error message, or a field name that only appears in one
                            "Tag 29 has no proxy (sub-tags 01-04).", "29"));
                    }
                    proxy = first.Value ?? string.Empty;
                    proxyType = first.Value == null ? PromptPayProxyType.Unknown : first.Type;
                    ota = aid == Aid.Ota;
                    subFields = SubFieldsOf(nodes);
                    // ^0066(\d{9})$
                    if (proxyType == PromptPayProxyType.Mobile && proxy.Length == 13 && proxy.StartsWith("0066", StringComparison.Ordinal)
                        && AllDigits(proxy.Substring(4)))
                    {
                        mobile = "0" + proxy.Substring(4);
                    }
                    otaCode = Sub(nodes, "05");
                }
                else if (bill != null)
                {
                    var (aid, nodes) = bill.Value;
                    merchantTag = "30";
                    kind = PromptPayKind.BillPayment;
                    billerId = Sub(nodes, "01");
                    if (billerId == null) return Fail(TingQrErrorCode.MissingTag,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Tag 30.01 (biller ID) is missing.", "30.01");
                    crossBorder = aid == Aid.BillPaymentCrossBorder;
                    subFields = SubFieldsOf(nodes);
                    ref1 = Sub(nodes, "02");
                    ref2 = Sub(nodes, "03");
                }
                else
                {
                    return Fail(TingQrErrorCode.UnsupportedScheme,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Not a PromptPay payload: no tag 29 or 30 with a PromptPay AID.", "29");
                }

                if (EmvPayloads.GetField(p, "00")?.Value != "01")
                {
                    return Fail(TingQrErrorCode.InvalidValue,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Tag 00 (payload format indicator) must be \"01\".", "00");
                }
                var poi = EmvPayloads.GetField(p, "01")?.Value;
                if (poi == null) return Fail(TingQrErrorCode.MissingTag,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Tag 01 (point of initiation) is missing; expected 11 or 12.", "01");
                if (poi != "11" && poi != "12")
                {
                    return Fail(TingQrErrorCode.InvalidValue,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"Tag 01 (point of initiation) is \"{poi}\", expected 11 or 12.", "01");
                }

                var required = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var (tag, fallback) in new[] { ("53", "764"), ("58", "TH") })
                {
                    var value = EmvPayloads.GetField(p, tag)?.Value;
                    if (value != null)
                    {
                        required[tag] = value;
                    }
                    else if (mode == ParseMode.Strict)
                    {
                        return Fail(TingQrErrorCode.MissingTag,
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Tag {tag} is required.", tag);
                    }
                    else
                    {
                        required[tag] = fallback;
                        warnings.Add(new TingQrWarning(TingQrWarningCode.MissingOptionalTag, $"Tag {tag} is missing; assumed \"{fallback}\".", tag));
                    }
                }

                var interpreted = new HashSet<string>(StringComparer.Ordinal) { "00", "01", merchantTag, "52", "53", "54", "58", "59", "60", "62", "63" };
                var data = new PromptPayData
                {
                    Kind = kind,
                    Initiation = poi == "12" ? QrInitiation.Dynamic : QrInitiation.Static,
                    Amount = EmvPayloads.GetField(p, "54")?.Value,
                    Currency = required["53"],
                    Country = required["58"],
                    MerchantName = EmvPayloads.GetField(p, "59")?.Value,
                    MerchantCity = EmvPayloads.GetField(p, "60")?.Value,
                    MerchantCategoryCode = EmvPayloads.GetField(p, "52")?.Value,
                    AdditionalData = Fields.ReadAdditionalData(p),
                    ExtraFields = Fields.ReadExtraFields(p, interpreted),
                    SubFields = subFields,
                    Ota = ota,
                    ProxyType = proxyType,
                    Proxy = proxy,
                    Mobile = mobile,
                    OtaCode = otaCode,
                    CrossBorder = crossBorder,
                    BillerId = billerId,
                    Reference1 = ref1,
                    Reference2 = ref2,
                };
                return TingQrResult<PromptPayData>.Success(data, warnings);
            }
            catch (TingQrException e)
            {
                return TingQrResult<PromptPayData>.Failure(e);
            }
        }
    }
}

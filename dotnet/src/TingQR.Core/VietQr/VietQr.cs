using System;
using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;

namespace TingQR
{
    /// <summary>VietQR (NAPAS) payloads: <c>encodeVietQr</c>/<c>decodeVietQr</c> of the TypeScript package.</summary>
    public static class VietQr
    {
        /// <summary>NAPAS VietQR GUID in tag 38.00.</summary>
        public const string Guid = "A000000727";

        private static readonly HashSet<string> InterpretedTags =
            new HashSet<string>(StringComparer.Ordinal) { "00", "01", "38", "52", "53", "54", "58", "59", "60", "62", "63" };

        private static string ServiceCode(VietQrService s) => s == VietQrService.Card ? "QRIBFTTC" : "QRIBFTTA";

        // Character tests are written out rather than as Regex: .NET's \d matches every Unicode digit and its $
        // matches before a final \n, unlike the JavaScript patterns of the TS implementation.
        private static bool IsAsciiDigit(char c) => c >= '0' && c <= '9';

        private static bool IsAsciiAlnum(char c) => IsAsciiDigit(c) || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');

        private static bool IsBin(string? s) => s != null && s.Length == 6 && s.All(IsAsciiDigit);

        private static bool IsAccount(string? s) => s != null && s.Length >= 3 && s.Length <= 25 && s.All(IsAsciiAlnum);

        // ^[1-9]\d{0,12}$
        private static bool IsAmount(string s) => s.Length >= 1 && s.Length <= 13 && s[0] != '0' && s.All(IsAsciiDigit);

        internal static bool IsPrintableAscii(string s) => s.All(c => c >= '\x20' && c <= '\x7E');

        private static string? AmountText(QrAmount? amount)
        {
            if (amount == null || !amount.Value.HasValue) return null;
            var text = amount.Value.Text!;
            if (!IsAmount(text))
            {
                // Stryker disable once all : "shown" is only used in the error message
                var shown = amount.Value.IsNumber ? text : "\"" + text + "\"";
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"Amount {shown} must be a whole number of VND, 1–13 digits, greater than zero.", "54");
            }
            return text;
        }

        /// <summary>
        /// Builds a VietQR (NAPAS) payload. Throws <see cref="TingQrException"/> on invalid input (including null);
        /// never silently changes it.
        /// </summary>
        public static string Encode(VietQrInput? input)
        {
            if (input == null)
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "VietQr.Encode needs an input object; got null.");
            }
            if (!IsBin(input.BankBin))
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"Bank BIN \"{input.BankBin}\" must be 6 digits.", "38");
            }
            if (!IsAccount(input.AccountNumber))
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"Account number \"{input.AccountNumber}\" must be 3–25 letters or digits.", "38");
            }
            var amount = AmountText(input.Amount);
            var purpose = string.IsNullOrEmpty(input.Purpose) ? null : input.Purpose;
            if (purpose != null && !IsPrintableAscii(purpose))
            {
                throw new TingQrException(TingQrErrorCode.NonAscii,
                    "Purpose must be printable ASCII; banking apps reject accented text. Use VietnameseText.RemoveAccents() first.",
                    "62");
            }
            if (input.Service != VietQrService.Account && input.Service != VietQrService.Card)
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"Service \"{input.Service}\" must be Account or Card.", "38");
            }

            var beneficiary = Tlv.Field("00", input.BankBin) + Tlv.Field("01", input.AccountNumber);
            var merchant = Tlv.Field("00", Guid) + Tlv.Field("01", beneficiary) + Tlv.Field("02", ServiceCode(input.Service));
            var fields = new List<TlvField>
            {
                new TlvField("00", "01"),
                new TlvField("01", amount != null ? "12" : "11"),
                new TlvField("38", merchant),
                new TlvField("53", "704"),
            };
            if (amount != null) fields.Add(new TlvField("54", amount));
            fields.Add(new TlvField("58", "VN"));
            if (purpose != null) fields.Add(new TlvField("62", Tlv.Field("08", purpose)));
            return EmvPayloads.Build(fields);
        }

        /// <summary>
        /// Reads a VietQR payload. Lenient mode (default) fills tags 53/58 when missing and reports every deviation
        /// in the warnings; <see cref="ParseMode.Strict"/> rejects them instead (use it to validate codes you
        /// generate). Never throws on bad data, including null.
        /// </summary>
        public static TingQrResult<VietQrData> Decode(string? payload, ParseMode mode = ParseMode.Lenient)
        {
            var parsed = EmvPayloads.Parse(payload);
            if (!parsed.Ok) return TingQrResult<VietQrData>.Failure(parsed.Error!);
            return Read(parsed.Value!, parsed.Warnings, mode);
        }

        private static string? Sub(IReadOnlyList<TlvNode> nodes, string tag) => nodes.FirstOrDefault(n => n.Tag == tag)?.Value;

        private static TingQrResult<VietQrData> Fail(TingQrErrorCode code, string message, string tag)
            => TingQrResult<VietQrData>.Failure(new TingQrException(code, message, tag));

        /// <summary><see cref="Decode"/> on a payload already parsed by <see cref="EmvPayloads.Parse"/>.</summary>
        internal static TingQrResult<VietQrData> Read(EmvPayload p, IReadOnlyList<TingQrWarning> parsedWarnings, ParseMode mode)
        {
            var warnings = new List<TingQrWarning>(parsedWarnings);
            try
            {
                var merchant = Fields.ReadSchemeTemplate(p, "38", Guid);
                if (merchant == null)
                {
                    return Fail(TingQrErrorCode.UnsupportedScheme,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Not a VietQR payload: tag 38 with GUID A000000727 is missing.", "38");
                }

                var beneficiaryValue = Sub(merchant, "01");
                if (beneficiaryValue == null) return Fail(TingQrErrorCode.MissingTag,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Tag 38.01 (beneficiary) is missing.", "38.01");
                var beneficiary = Tlv.ParseTemplate(beneficiaryValue, "38.01");
                var bankBin = Sub(beneficiary, "00");
                var accountNumber = Sub(beneficiary, "01");
                if (bankBin == null || accountNumber == null)
                {
                    return Fail(TingQrErrorCode.MissingTag,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Tag 38.01 must hold the bank BIN (00) and account number (01).", "38.01");
                }

                var serviceCode = Sub(merchant, "02");
                if (serviceCode == null) return Fail(TingQrErrorCode.MissingTag,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Tag 38.02 (service code) is missing.", "38.02");
                VietQrService service;
                if (serviceCode == "QRIBFTTA") service = VietQrService.Account;
                else if (serviceCode == "QRIBFTTC") service = VietQrService.Card;
                else return Fail(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"Service code \"{serviceCode}\" is not QRIBFTTA or QRIBFTTC.", "38.02");

                if (EmvPayloads.GetField(p, "00")?.Value != "01")
                {
                    return Fail(TingQrErrorCode.InvalidValue,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Tag 00 (payload format indicator) must be \"01\".", "00");
                }
                var poi = EmvPayloads.GetField(p, "01")?.Value;
                if (poi == null) return Fail(TingQrErrorCode.MissingTag, "Tag 01 (point of initiation) is missing; expected 11 or 12.", "01");
                if (poi != "11" && poi != "12")
                {
                    return Fail(TingQrErrorCode.InvalidValue,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"Tag 01 (point of initiation) is \"{poi}\", expected 11 or 12.", "01");
                }

                var required = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var (tag, fallback) in new[] { ("53", "704"), ("58", "VN") })
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
                        warnings.Add(new TingQrWarning(TingQrWarningCode.MissingOptionalTag,
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Tag {tag} is missing; assumed \"{fallback}\".", tag));
                    }
                }

                var additional = Fields.ReadAdditionalData(p);
                string? purpose = null;
                if (additional != null && additional.TryGetValue("08", out var p08)) purpose = p08;
                var data = new VietQrData
                {
                    BankBin = bankBin,
                    AccountNumber = accountNumber,
                    Service = service,
                    Initiation = poi == "12" ? QrInitiation.Dynamic : QrInitiation.Static,
                    Currency = required["53"],
                    Country = required["58"],
                    Amount = EmvPayloads.GetField(p, "54")?.Value,
                    AdditionalData = additional,
                    Purpose = purpose,
                    MerchantName = EmvPayloads.GetField(p, "59")?.Value,
                    MerchantCity = EmvPayloads.GetField(p, "60")?.Value,
                    MerchantCategoryCode = EmvPayloads.GetField(p, "52")?.Value,
                    ExtraFields = Fields.ReadExtraFields(p, InterpretedTags),
                };
                return TingQrResult<VietQrData>.Success(data, warnings);
            }
            catch (TingQrException e)
            {
                return TingQrResult<VietQrData>.Failure(e);
            }
        }
    }
}

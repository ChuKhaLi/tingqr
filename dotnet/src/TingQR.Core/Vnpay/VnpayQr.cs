using System;
using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;

namespace TingQR
{
    /// <summary>VNPAY-QR merchant payloads: <c>decodeVnpayQr</c> of the TypeScript package (decode only).</summary>
    public static class VnpayQr
    {
        /// <summary>VNPAY GUID in tag 26.00.</summary>
        public const string Guid = "A000000775";

        private static readonly HashSet<string> InterpretedTags =
            new HashSet<string>(StringComparer.Ordinal) { "00", "01", "26", "52", "53", "54", "58", "59", "60", "62", "63" };

        // Checked in this order; the warnings follow it.
        private static readonly string[] StandardTags = { "52", "53", "58", "59", "60" };

        private static string? DefaultOf(string tag) => tag == "53" ? "704" : tag == "58" ? "VN" : null;

        private static TingQrResult<VnpayQrData> Fail(TingQrErrorCode code, string message, string tag)
            => TingQrResult<VnpayQrData>.Failure(new TingQrException(code, message, tag));

        /// <summary>
        /// Reads a VNPAY-QR merchant payload. Lenient mode (default) accepts codes without the EMV tags 52/59/60
        /// (real VNPAY codes usually lack 52 and 60) and reports each in the warnings;
        /// <see cref="ParseMode.Strict"/> requires 52, 53, 58, 59, 60. Never throws on bad data, including null.
        /// </summary>
        public static TingQrResult<VnpayQrData> Decode(string? payload, ParseMode mode = ParseMode.Lenient)
        {
            var parsed = EmvPayloads.Parse(payload);
            if (!parsed.Ok) return TingQrResult<VnpayQrData>.Failure(parsed.Error!);
            return Read(parsed.Value!, parsed.Warnings, mode);
        }

        /// <summary><see cref="Decode"/> on a payload already parsed by <see cref="EmvPayloads.Parse"/>.</summary>
        internal static TingQrResult<VnpayQrData> Read(EmvPayload p, IReadOnlyList<TingQrWarning> parsedWarnings, ParseMode mode)
        {
            var warnings = new List<TingQrWarning>(parsedWarnings);
            try
            {
                var provider = Fields.ReadSchemeTemplate(p, "26", Guid);
                if (provider == null)
                {
                    return Fail(TingQrErrorCode.UnsupportedScheme,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Not a VNPAY-QR payload: tag 26 with GUID A000000775 is missing.", "26");
                }
                var merchantId = provider.FirstOrDefault(n => n.Tag == "01")?.Value;
                if (merchantId == null) return Fail(TingQrErrorCode.MissingTag,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Tag 26.01 (merchant ID) is missing.", "26.01");

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

                var standard = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var tag in StandardTags)
                {
                    var value = EmvPayloads.GetField(p, tag)?.Value;
                    if (value != null)
                    {
                        standard[tag] = value;
                        continue;
                    }
                    if (mode == ParseMode.Strict) return Fail(TingQrErrorCode.MissingTag,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"Tag {tag} is required by the EMV standard.", tag);
                    var fallback = DefaultOf(tag);
                    if (fallback != null) standard[tag] = fallback;
                    warnings.Add(new TingQrWarning(TingQrWarningCode.MissingOptionalTag,
                        // Stryker disable once all : picks between two error messages
                        fallback == null ?
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Tag {tag} is missing." :
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Tag {tag} is missing; assumed \"{fallback}\".", tag));
                }

                var providerData = provider.Where(n => n.Tag != "00" && n.Tag != "01").ToList();
                var additional = Fields.ReadAdditionalData(p);
                string? Named(string sub)
                {
                    string? v = null;
                    additional?.TryGetValue(sub, out v);
                    return v;
                }
                string? Std(string tag) => standard.TryGetValue(tag, out var v) ? v : null;

                var data = new VnpayQrData
                {
                    MerchantId = merchantId,
                    ProviderData = providerData.Count > 0 ? providerData.ToDictionary(n => n.Tag, n => n.Value) : null,
                    Initiation = poi == "12" ? QrInitiation.Dynamic : QrInitiation.Static,
                    Amount = EmvPayloads.GetField(p, "54")?.Value,
                    Currency = standard["53"],
                    Country = standard["58"],
                    MerchantName = Std("59"),
                    MerchantCity = Std("60"),
                    MerchantCategoryCode = Std("52"),
                    AdditionalData = additional,
                    BillNumber = Named("01"),
                    MobileNumber = Named("02"),
                    Store = Named("03"),
                    LoyaltyNumber = Named("04"),
                    Reference = Named("05"),
                    CustomerLabel = Named("06"),
                    Terminal = Named("07"),
                    Purpose = Named("08"),
                    ExtraFields = Fields.ReadExtraFields(p, InterpretedTags),
                };
                return TingQrResult<VnpayQrData>.Success(data, warnings);
            }
            catch (TingQrException e)
            {
                return TingQrResult<VnpayQrData>.Failure(e);
            }
        }
    }
}

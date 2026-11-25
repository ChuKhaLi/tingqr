using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using TingQR.Emv;

namespace TingQR
{
    /// <summary>Cambodian KHQR (Bakong): <c>encodeKhqr</c>, <c>decodeKhqr</c> and <c>isKhqrExpired</c> of the TypeScript package.</summary>
    public static class Khqr
    {
        private const int MaxAmountLength = 13;

        private static bool IsAsciiDigit(char c) => c >= '0' && c <= '9';

        private static bool AllDigits(string s) => s.Length > 0 && s.All(IsAsciiDigit);

        private static bool IsAsciiLetter(char c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

        // name@bank: exactly one '@', with a non-empty name and bank.
        private static bool IsBakongAccount(string s)
        {
            var at = s.IndexOf('@');
            return at > 0 && at < s.Length - 1 && s.IndexOf('@', at + 1) == -1;
        }

        private static TingQrException Invalid(string message, string tag) => new TingQrException(TingQrErrorCode.InvalidValue, message, tag);

        // Stryker disable once all : Quote only formats error messages
        private static string Quote(string? s) => s == null ? "null" : "\"" + s + "\"";

        // An optional (or, with required, mandatory) text field of at most max code points.
        private static string? Text(string? value, string name, string tag, int max, bool required = false, bool ascii = true)
        {
            if (string.IsNullOrEmpty(value))
            {
                if (required) throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"{name} is required.", tag);
                return null;
            }
            if (ascii && !VietQr.IsPrintableAscii(value!))
            {
                throw new TingQrException(TingQrErrorCode.NonAscii,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"{name} must be printable ASCII; only alternateLanguage may hold other scripts.", tag);
            }
            var length = CodePoints.Count(value!);
            if (length > max) throw Invalid(
                // Stryker disable once String : error message, or a field name that only appears in one
                $"{name} is {length} characters; the maximum is {max}.", tag);
            return value;
        }

        private static long Timestamp(long value, string name, string tag)
        {
            if (value < 1000000000000L || value > 9999999999999L) throw Invalid(
                // Stryker disable once String : error message, or a field name that only appears in one
                $"{name} must be Unix milliseconds (13 digits).", tag);
            return value;
        }

        private static string TrimLeadingZeros(string s)
        {
            var t = s.TrimStart('0');
            return t.Length == 0 ? "0" : t;
        }

        // Tag 54 as the SDK writes it: KHR whole, USD whole or with two decimals. Null for no amount.
        private static string? AmountText(QrAmount? amount, bool usd)
        {
            if (amount == null || !amount.Value.HasAmount) return null;
            var raw = amount.Value.Text!;
            string? output = null;
            if (!usd)
            {
                if (AllDigits(raw)) output = TrimLeadingZeros(raw);
            }
            else
            {
                var dot = raw.IndexOf('.');
                var whole = dot == -1 ? raw : raw.Substring(0, dot);
                var frac = dot == -1 ? null : raw.Substring(dot + 1);
                if (AllDigits(whole) && (frac == null || (frac.Length >= 1 && frac.Length <= 2 && AllDigits(frac))))
                {
                    output = TrimLeadingZeros(whole) + (frac == null ? string.Empty : "." + frac.PadRight(2, '0'));
                }
            }
            if (output == null || output.All(c => c == '0' || c == '.') || output.Length > MaxAmountLength)
            {
                // Stryker disable once all : "shown" is only used in the error message
                var shown = amount.Value.IsNumber ? raw : Quote(raw);
                throw Invalid(
                    // Stryker disable once all : picks between two error messages
                    usd
                        ?
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Amount {shown} must be greater than zero with at most 2 decimals."
                        :
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Amount {shown} must be a whole number of KHR greater than zero.",
                    "54");
            }
            return output;
        }

        private static (string Tag, string Value) AccountTemplate(KhqrInput input)
        {
            var merchant = input.AccountType == KhqrAccountType.Merchant;
            if (!merchant && input.AccountType != KhqrAccountType.Individual)
            {
                throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "accountType must be Individual or Merchant.", "29");
            }
            var tag = merchant ? "30" : "29";
            var account = Text(input.BakongAccountId,
                // Stryker disable once String : error message, or a field name that only appears in one
                "bakongAccountId", tag + ".00", 32, required: true)!;
            if (!IsBakongAccount(account)) throw Invalid(
                // Stryker disable once String : error message, or a field name that only appears in one
                "bakongAccountId must be name@bank with exactly one \"@\".", tag + ".00");
            if (merchant && input.AccountInformation != null)
            {
                throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "accountInformation is for individual accounts; a merchant uses merchantId.", "30");
            }
            if (!merchant && input.MerchantId != null)
            {
                throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "merchantId is for merchant accounts; an individual uses accountInformation.", "29");
            }
            var first = merchant
                ? Text(input.MerchantId,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "merchantId", "30.01", 32, required: true)
                : Text(input.AccountInformation,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "accountInformation", "29.01", 32);
            var bank = Text(input.AcquiringBank,
                // Stryker disable once String : error message, or a field name that only appears in one
                "acquiringBank", tag + ".02", 32, required: merchant);
            var value = Tlv.Field("00", account);
            if (first != null) value += Tlv.Field("01", first);
            if (bank != null) value += Tlv.Field("02", bank);
            return (tag, value);
        }

        /// <summary>
        /// Builds a Cambodian KHQR payload, in the tag order of the official Bakong SDK (00, 01, 29/30, 52, 53, 54, 58,
        /// 59, 60, 62, 64, 99, 63). Timestamps come from <see cref="KhqrInput.CreatedAt"/>/<see cref="KhqrInput.ExpiresAt"/>,
        /// never from the clock. Tag 99 is written for a dynamic code, or for a static one when <c>ExpiresAt</c> is given.
        /// Throws <see cref="TingQrException"/> on invalid input (including null); never rounds or silently changes it.
        /// </summary>
        public static string Encode(KhqrInput? input)
        {
            if (input == null)
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Khqr.Encode needs an input object; got null.");
            }
            var (accountTag, account) = AccountTemplate(input);
            var mcc = input.MerchantCategoryCode ?? "5999";
            if (mcc.Length != 4 || !AllDigits(mcc)) throw Invalid(
                // Stryker disable once String : error message, or a field name that only appears in one
                "merchantCategoryCode must be 4 digits.", "52");
            string numeric;
            bool usd;
            switch (input.Currency)
            {
                case "KHR":
                case "116":
                    numeric = "116";
                    usd = false;
                    break;
                case "USD":
                case "840":
                    numeric = "840";
                    usd = true;
                    break;
                default:
                    throw Invalid(
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "currency must be 'KHR', 'USD', '116' or '840'.", "53");
            }
            var amount = AmountText(input.Amount, usd);
            var name = Text(input.MerchantName,
                // Stryker disable once String : error message, or a field name that only appears in one
                "merchantName", "59", 25, required: true)!;
            var city = Text(input.MerchantCity,
                // Stryker disable once String : error message, or a field name that only appears in one
                "merchantCity", "60", 15) ?? "Phnom Penh";

            var extra = new[]
            {
                ("01",
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "billNumber", input.BillNumber),
                ("02",
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "mobileNumber", input.MobileNumber),
                ("03",
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "storeLabel", input.StoreLabel),
                ("07",
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "terminalLabel", input.TerminalLabel),
                ("08",
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "purpose", input.Purpose),
            };
            var additional = string.Empty;
            foreach (var (sub, key, raw) in extra)
            {
                var v = Text(raw, key, "62." + sub, 25);
                if (v != null) additional += Tlv.Field(sub, v);
            }

            var language = string.Empty;
            if (input.AlternateLanguage != null)
            {
                var alt = input.AlternateLanguage;
                var code = Text(alt.Language,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "alternateLanguage.language", "64.00", 2, required: true)!;
                // Two ASCII letters, case kept (the SDK writes both 'km' and 'KM').
                if (code.Length != 2 || !code.All(IsAsciiLetter))
                {
                    throw Invalid(
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"alternateLanguage.language \"{code}\" must be 2 letters (ISO 639-1).", "64.00");
                }
                language += Tlv.Field("00", code);
                language += Tlv.Field("01", Text(alt.MerchantName,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "alternateLanguage.merchantName", "64.01", 25, required: true, ascii: false)!);
                var altCity = Text(alt.MerchantCity,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "alternateLanguage.merchantCity", "64.02", 15, ascii: false);
                if (altCity != null) language += Tlv.Field("02", altCity);
            }

            var createdAt = Timestamp(input.CreatedAt,
                // Stryker disable once String : error message, or a field name that only appears in one
                "createdAt", "99.00");
            long? expiresAt = null;
            if (input.ExpiresAt.HasValue)
            {
                expiresAt = Timestamp(input.ExpiresAt.Value,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "expiresAt", "99.01");
                if (expiresAt.Value <= createdAt) throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "expiresAt must be after createdAt.", "99.01");
            }
            else if (amount != null)
            {
                throw Invalid(
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "A KHQR with an amount must have expiresAt.", "99.01");
            }

            var fields = new List<TlvField>
            {
                new TlvField("00", "01"),
                new TlvField("01", amount != null ? "12" : "11"),
                new TlvField(accountTag, account),
                new TlvField("52", mcc),
                new TlvField("53", numeric),
            };
            if (amount != null) fields.Add(new TlvField("54", amount));
            fields.Add(new TlvField("58", "KH"));
            fields.Add(new TlvField("59", name));
            fields.Add(new TlvField("60", city));
            if (additional.Length > 0) fields.Add(new TlvField("62", additional));
            if (language.Length > 0) fields.Add(new TlvField("64", language));
            if (expiresAt.HasValue)
            {
                fields.Add(new TlvField("99", Tlv.Field("00", createdAt.ToString(CultureInfo.InvariantCulture))
                    + Tlv.Field("01", expiresAt.Value.ToString(CultureInfo.InvariantCulture))));
            }
            return EmvPayload.Build(fields);
        }

        /// <summary>
        /// Reads a Cambodian KHQR (Bakong) payload, individual (tag 29) or merchant (tag 30); tag 58, when present, must
        /// be <c>KH</c> or the payload is not KHQR (UNSUPPORTED_SCHEME). Lenient mode (default) accepts codes missing
        /// tags 52/58/59/60 or a dynamic code without an expiry (99.01), reporting each in the warnings;
        /// <see cref="ParseMode.Strict"/> rejects them. Missing tag 53 is an error in both modes. Never compares with
        /// the clock: use <see cref="IsExpired"/>. Never throws on bad data, including null.
        /// </summary>
        public static TingQrResult<KhqrData> Decode(string? payload, ParseMode mode = ParseMode.Lenient)
        {
            var parsed = EmvPayload.Parse(payload);
            if (!parsed.Ok) return TingQrResult<KhqrData>.Failure(parsed.Error!);
            return Read(parsed.Value!, parsed.Warnings, mode);
        }

        private static TingQrResult<KhqrData> Fail(TingQrErrorCode code, string message, string? tag = null)
            => TingQrResult<KhqrData>.Failure(new TingQrException(code, message, tag));

        private static string? Sub(IReadOnlyList<TlvNode> nodes, string tag) => nodes.FirstOrDefault(n => n.Tag == tag)?.Value;

        // The sub-fields of tag 29/30 when it is clean TLV whose 00 is a Bakong account ('name@bank').
        private static IReadOnlyList<TlvNode>? ReadAccount(EmvPayload p, string tag)
        {
            var value = p.GetField(tag)?.Value;
            if (value == null) return null;
            IReadOnlyList<TlvNode> nodes;
            try
            {
                nodes = Tlv.Parse(value);
            }
            catch (TingQrException)
            {
                return null;
            }
            var account = Sub(nodes, "00");
            if (account == null || !IsBakongAccount(account)) return null;
            Tlv.AssertUniqueTags(nodes.Cast<TlvField>(), tag);
            return nodes;
        }

        private static bool IsTimestamp(string s) => s.Length == 13 && s.All(IsAsciiDigit);

        /// <summary><see cref="Decode"/> on a payload already parsed by <see cref="EmvPayload.Parse"/>.</summary>
        internal static TingQrResult<KhqrData> Read(EmvPayload p, IReadOnlyList<TingQrWarning> parsedWarnings, ParseMode mode)
        {
            var warnings = new List<TingQrWarning>(parsedWarnings);
            try
            {
                var country = p.GetField("58")?.Value;
                if (country != null && country != "KH")
                {
                    return Fail(TingQrErrorCode.UnsupportedScheme,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"Not a KHQR payload: tag 58 (country) is \"{country}\", not \"KH\".", "29");
                }
                var individual = ReadAccount(p, "29");
                var merchant = individual != null ? null : ReadAccount(p, "30");
                var account = individual != null ? individual : merchant;
                if (account == null)
                {
                    return Fail(TingQrErrorCode.UnsupportedScheme,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Not a KHQR payload: no tag 29 or 30 holding a Bakong account (name@bank).", "29");
                }
                var accountTag = individual != null ? "29" : "30";
                if (merchant != null)
                {
                    foreach (var (s, what) in new[] { ("01",
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "merchant ID"), ("02",
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "acquiring bank") })
                    {
                        if (Sub(merchant, s) == null) return Fail(TingQrErrorCode.MissingTag,
                            // Stryker disable once String : error message, or a field name that only appears in one
                            $"Tag 30.{s} ({what}) is missing.", "30." + s);
                    }
                }

                if (p.GetField("00")?.Value != "01")
                {
                    return Fail(TingQrErrorCode.InvalidValue,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Tag 00 (payload format indicator) must be \"01\".", "00");
                }
                var poi = p.GetField("01")?.Value;
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
                foreach (var tag in new[] { "52", "53", "58", "59", "60" })
                {
                    var v = p.GetField(tag)?.Value;
                    if (v != null)
                    {
                        standard[tag] = v;
                        continue;
                    }
                    if (mode == ParseMode.Strict || tag == "53") return Fail(TingQrErrorCode.MissingTag,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"Tag {tag} is required by KHQR.", tag);
                    if (tag == "58") standard[tag] = "KH";
                    warnings.Add(new TingQrWarning(TingQrWarningCode.MissingOptionalTag,
                        // Stryker disable once all : picks between two error messages
                        tag == "58" ? "Tag 58 is missing; assumed \"KH\"." :
                        // Stryker disable once String : error message, or a field name that only appears in one
                        $"Tag {tag} is missing.", tag));
                }

                var currency = standard["53"];
                var additional = Fields.ReadAdditionalData(p);

                KhqrAlternateLanguageData? alternate = null;
                var language = p.GetField("64")?.Value;
                if (language != null)
                {
                    var nodes = Tlv.ParseTemplate(language, "64");
                    alternate = new KhqrAlternateLanguageData
                    {
                        Language = Sub(nodes, "00"),
                        MerchantName = Sub(nodes, "01"),
                        MerchantCity = Sub(nodes, "02"),
                    };
                }

                IReadOnlyDictionary<string, string>? timestamp = null;
                long? createdAt = null, expiresAt = null;
                var stamp = p.GetField("99")?.Value;
                if (stamp != null)
                {
                    timestamp = ReadOnly.Dictionary(Tlv.ParseTemplate(stamp, "99").ToDictionary(n => n.Tag, n => n.Value));
                    foreach (var s in new[] { "00", "01" })
                    {
                        if (!timestamp.TryGetValue(s, out var v)) continue;
                        if (IsTimestamp(v))
                        {
                            var n = long.Parse(v, NumberStyles.None, CultureInfo.InvariantCulture);
                            if (s == "00") createdAt = n; else expiresAt = n;
                        }
                        else if (mode == ParseMode.Strict)
                        {
                            return Fail(TingQrErrorCode.InvalidValue,
                                // Stryker disable once String : error message, or a field name that only appears in one
                                $"Tag 99.{s} must be Unix milliseconds (13 digits).", "99." + s);
                        }
                    }
                }
                var dynamic = poi == "12";
                if (dynamic && expiresAt == null)
                {
                    if (mode == ParseMode.Strict) return Fail(TingQrErrorCode.MissingTag,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "A dynamic KHQR must carry an expiry time (99.01).", "99.01");
                    warnings.Add(new TingQrWarning(TingQrWarningCode.MissingOptionalTag,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "Dynamic KHQR without a readable expiry time (99.01).", "99.01"));
                }

                var interpreted = new HashSet<string>(StringComparer.Ordinal)
                {
                    "00", "01", "15", accountTag, "52", "53", "54", "58", "59", "60", "61", "62", "63", "64", "99",
                };
                string? Extra(string sub) => additional != null && additional.TryGetValue(sub, out var v) ? v : null;
                string? Std(string tag) => standard.TryGetValue(tag, out var v) ? v : null;
                var data = new KhqrData
                {
                    AccountType = individual != null ? KhqrAccountType.Individual : KhqrAccountType.Merchant,
                    BakongAccountId = Sub(account, "00")!,
                    AccountInformation = individual != null ? Sub(account, "01") : null,
                    MerchantId = individual != null ? null : Sub(account, "01"),
                    AcquiringBank = Sub(account, "02"),
                    Initiation = dynamic ? QrInitiation.Dynamic : QrInitiation.Static,
                    Currency = currency,
                    CurrencyAlpha = currency == "116" ? "KHR" : currency == "840" ? "USD" : null,
                    Amount = p.GetField("54")?.Value,
                    MerchantCategoryCode = Std("52"),
                    MerchantName = Std("59"),
                    MerchantCity = Std("60"),
                    PostalCode = p.GetField("61")?.Value,
                    UnionPay = p.GetField("15")?.Value,
                    Country = standard["58"],
                    AdditionalData = additional,
                    BillNumber = Extra("01"),
                    MobileNumber = Extra("02"),
                    StoreLabel = Extra("03"),
                    TerminalLabel = Extra("07"),
                    Purpose = Extra("08"),
                    AlternateLanguage = alternate,
                    CreatedAt = createdAt,
                    ExpiresAt = expiresAt,
                    Timestamp = timestamp,
                    ExtraFields = Fields.ReadExtraFields(p, interpreted),
                };
                return TingQrResult<KhqrData>.Success(data, warnings);
            }
            catch (TingQrException e)
            {
                return TingQrResult<KhqrData>.Failure(e);
            }
        }

        /// <summary>
        /// Whether <paramref name="data"/> has expired at <paramref name="nowMs"/> (Unix milliseconds): true once
        /// <c>nowMs</c> is past <see cref="KhqrData.ExpiresAt"/>, as the Bakong SDK checks. Null when the code has no
        /// 13-digit expiry time. Pass the time explicitly; tingqr never reads the clock.
        /// </summary>
        public static bool? IsExpired(KhqrData data, long nowMs)
            => data.ExpiresAt.HasValue ? nowMs > data.ExpiresAt.Value : (bool?)null;
    }
}

using System.Collections.Generic;

namespace TingQR
{
    /// <summary>Tag 64 of a decoded KHQR. Each part is null when the payload does not carry it.</summary>
    public sealed record KhqrAlternateLanguageData
    {
        /// <summary>64.00, verbatim (<c>km</c> or <c>KM</c>).</summary>
        public string? Language { get; init; }

        /// <summary>64.01.</summary>
        public string? MerchantName { get; init; }

        /// <summary>64.02.</summary>
        public string? MerchantCity { get; init; }
    }

    /// <summary>A decoded KHQR (Bakong) payload. Optional fields are null when the payload does not carry them.</summary>
    public sealed record KhqrData
    {
        /// <summary>Tag 29 (individual) or 30 (merchant).</summary>
        public required KhqrAccountType AccountType { get; init; }

        /// <summary>Sub-tag 00 of tag 29/30: the Bakong account, <c>name@bank</c>.</summary>
        public required string BakongAccountId { get; init; }

        /// <summary>Tag 29.01.</summary>
        public string? AccountInformation { get; init; }

        /// <summary>Tag 30.01.</summary>
        public string? MerchantId { get; init; }

        /// <summary>Tag 29.02 / 30.02.</summary>
        public string? AcquiringBank { get; init; }

        /// <summary>Tag 01: <c>11</c> static, <c>12</c> dynamic.</summary>
        public required QrInitiation Initiation { get; init; }

        /// <summary>Tag 53 verbatim, the ISO 4217 numeric code (<c>116</c> KHR, <c>840</c> USD).</summary>
        public required string Currency { get; init; }

        /// <summary><c>KHR</c> for 116, <c>USD</c> for 840; null for other codes.</summary>
        public string? CurrencyAlpha { get; init; }

        /// <summary>Tag 54, verbatim.</summary>
        public string? Amount { get; init; }

        /// <summary>Tag 52.</summary>
        public string? MerchantCategoryCode { get; init; }

        /// <summary>Tag 59.</summary>
        public string? MerchantName { get; init; }

        /// <summary>Tag 60.</summary>
        public string? MerchantCity { get; init; }

        /// <summary>Tag 61.</summary>
        public string? PostalCode { get; init; }

        /// <summary>Tag 15.</summary>
        public string? UnionPay { get; init; }

        /// <summary>Tag 58 verbatim; <c>KH</c> when missing in lenient mode.</summary>
        public required string Country { get; init; }

        /// <summary>Every sub-tag of tag 62, keyed by sub-tag, verbatim.</summary>
        public IReadOnlyDictionary<string, string>? AdditionalData { get; init; }

        /// <summary>62.01.</summary>
        public string? BillNumber { get; init; }

        /// <summary>62.02.</summary>
        public string? MobileNumber { get; init; }

        /// <summary>62.03.</summary>
        public string? StoreLabel { get; init; }

        /// <summary>62.07.</summary>
        public string? TerminalLabel { get; init; }

        /// <summary>62.08.</summary>
        public string? Purpose { get; init; }

        /// <summary>Tag 64.</summary>
        public KhqrAlternateLanguageData? AlternateLanguage { get; init; }

        /// <summary>Tag 99.00 as Unix milliseconds, when it is 13 digits.</summary>
        public long? CreatedAt { get; init; }

        /// <summary>Tag 99.01 as Unix milliseconds, when it is 13 digits.</summary>
        public long? ExpiresAt { get; init; }

        /// <summary>Every sub-tag of tag 99, verbatim.</summary>
        public IReadOnlyDictionary<string, string>? Timestamp { get; init; }

        /// <summary>Top-level tags the reader does not interpret, keyed by tag, value verbatim.</summary>
        public IReadOnlyDictionary<string, string>? ExtraFields { get; init; }
    }
}

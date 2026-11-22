using System.Collections.Generic;

namespace TingQR
{
    /// <summary>A decoded VNPAY-QR payload. Optional fields are null when the payload does not carry them.</summary>
    public sealed record VnpayQrData
    {
        /// <summary>Tag 26.01.</summary>
        public required string MerchantId { get; init; }

        /// <summary>Sub-tags of tag 26 other than 00 and 01.</summary>
        public IReadOnlyDictionary<string, string>? ProviderData { get; init; }

        /// <summary>Tag 01: <c>11</c> static (VNPAY uses it even with an amount), <c>12</c> dynamic.</summary>
        public required QrInitiation Initiation { get; init; }

        /// <summary>Tag 54, verbatim.</summary>
        public string? Amount { get; init; }

        /// <summary>Tag 53 verbatim; <c>704</c> when missing in lenient mode.</summary>
        public required string Currency { get; init; }

        /// <summary>Tag 58 verbatim; <c>VN</c> when missing in lenient mode.</summary>
        public required string Country { get; init; }

        /// <summary>Tag 59.</summary>
        public string? MerchantName { get; init; }

        /// <summary>Tag 60.</summary>
        public string? MerchantCity { get; init; }

        /// <summary>Tag 52.</summary>
        public string? MerchantCategoryCode { get; init; }

        /// <summary>Every sub-tag of tag 62, keyed by sub-tag.</summary>
        public IReadOnlyDictionary<string, string>? AdditionalData { get; init; }

        /// <summary>Tag 62.01.</summary>
        public string? BillNumber { get; init; }

        /// <summary>Tag 62.02.</summary>
        public string? MobileNumber { get; init; }

        /// <summary>Tag 62.03.</summary>
        public string? Store { get; init; }

        /// <summary>Tag 62.04.</summary>
        public string? LoyaltyNumber { get; init; }

        /// <summary>Tag 62.05.</summary>
        public string? Reference { get; init; }

        /// <summary>Tag 62.06.</summary>
        public string? CustomerLabel { get; init; }

        /// <summary>Tag 62.07.</summary>
        public string? Terminal { get; init; }

        /// <summary>Tag 62.08.</summary>
        public string? Purpose { get; init; }

        /// <summary>Top-level tags the reader does not interpret, keyed by tag, value verbatim.</summary>
        public IReadOnlyDictionary<string, string>? ExtraFields { get; init; }
    }
}

using System.Collections.Generic;

namespace TingQR
{
    /// <summary>A decoded VietQR payload. Optional fields are null when the payload does not carry them.</summary>
    public sealed record VietQrData
    {
        /// <summary>Tag 38.01.00.</summary>
        public required string BankBin { get; init; }

        /// <summary>Tag 38.01.01.</summary>
        public required string AccountNumber { get; init; }

        /// <summary>Tag 38.02.</summary>
        public required VietQrServiceCode Service { get; init; }

        /// <summary>Tag 01: <c>11</c> static, <c>12</c> dynamic.</summary>
        public required QrInitiation Initiation { get; init; }

        /// <summary>Tag 54, verbatim.</summary>
        public string? Amount { get; init; }

        /// <summary>Tag 62.08.</summary>
        public string? Purpose { get; init; }

        /// <summary>Every sub-tag of tag 62 (including <c>08</c>), keyed by sub-tag.</summary>
        public IReadOnlyDictionary<string, string>? AdditionalData { get; init; }

        /// <summary>Tag 59.</summary>
        public string? MerchantName { get; init; }

        /// <summary>Tag 60.</summary>
        public string? MerchantCity { get; init; }

        /// <summary>Tag 52.</summary>
        public string? MerchantCategoryCode { get; init; }

        /// <summary>Top-level tags the reader does not interpret (e.g. 26, 80), keyed by tag, value verbatim.</summary>
        public IReadOnlyDictionary<string, string>? ExtraFields { get; init; }

        /// <summary>Tag 53 verbatim; <c>704</c> when missing in lenient mode.</summary>
        public required string Currency { get; init; }

        /// <summary>Tag 58 verbatim; <c>VN</c> when missing in lenient mode.</summary>
        public required string Country { get; init; }
    }
}

using System.Collections.Generic;

namespace TingQR
{
    /// <summary>Which PromptPay template a payload uses. JSON: <c>credit-transfer</c>/<c>bill-payment</c>.</summary>
    public enum PromptPayKind
    {
        /// <summary>Tag 29: credit transfer to a proxy.</summary>
        CreditTransfer,

        /// <summary>Tag 30: bill payment.</summary>
        BillPayment,
    }

    /// <summary>Which sub-tag of tag 29 carries the proxy.</summary>
    public enum PromptPayProxyType
    {
        /// <summary>Sub-tag 01.</summary>
        Mobile,

        /// <summary>Sub-tag 02.</summary>
        NationalId,

        /// <summary>Sub-tag 03.</summary>
        EWallet,

        /// <summary>Sub-tag 04.</summary>
        BankAccount,

        /// <summary>None of sub-tags 01-04 is present (lenient mode only).</summary>
        Unknown,
    }

    /// <summary>
    /// A decoded PromptPay payload. Fields that belong to the other <see cref="Kind"/> are null.
    /// </summary>
    public sealed record PromptPayData
    {
        /// <summary>Credit transfer (tag 29) or bill payment (tag 30).</summary>
        public required PromptPayKind Kind { get; init; }

        /// <summary>Tag 01: <c>11</c> static, <c>12</c> dynamic.</summary>
        public required QrInitiation Initiation { get; init; }

        /// <summary>Tag 54, verbatim.</summary>
        public string? Amount { get; init; }

        /// <summary>Tag 53 verbatim; <c>764</c> when missing in lenient mode.</summary>
        public required string Currency { get; init; }

        /// <summary>Tag 58 verbatim; <c>TH</c> when missing in lenient mode.</summary>
        public required string Country { get; init; }

        /// <summary>Tag 59.</summary>
        public string? MerchantName { get; init; }

        /// <summary>Tag 60.</summary>
        public string? MerchantCity { get; init; }

        /// <summary>Tag 52.</summary>
        public string? MerchantCategoryCode { get; init; }

        /// <summary>Every sub-tag of tag 62, keyed by sub-tag, verbatim.</summary>
        public IReadOnlyDictionary<string, string>? AdditionalData { get; init; }

        /// <summary>Top-level tags the reader does not interpret, keyed by tag, value verbatim.</summary>
        public IReadOnlyDictionary<string, string>? ExtraFields { get; init; }

        /// <summary>Every sub-tag of tag 29 or 30 except 00, verbatim.</summary>
        public required IReadOnlyDictionary<string, string> SubFields { get; init; }

        /// <summary>Credit transfer: true when tag 29.00 is the OTA AID. Null for a bill payment.</summary>
        public bool? Ota { get; init; }

        /// <summary>Credit transfer: which of sub-tags 01-04 comes first. Null for a bill payment.</summary>
        public PromptPayProxyType? ProxyType { get; init; }

        /// <summary>Credit transfer: verbatim value of that sub-tag; empty when none is present (lenient mode only). Null for a bill payment.</summary>
        public string? Proxy { get; init; }

        /// <summary>Credit transfer: a mobile proxy written as 0066 + 9 digits, as a local number (<c>0</c> + 9 digits).</summary>
        public string? Mobile { get; init; }

        /// <summary>Credit transfer: tag 29.05.</summary>
        public string? OtaCode { get; init; }

        /// <summary>Bill payment: true when tag 30.00 is the cross-border AID. Null for a credit transfer.</summary>
        public bool? CrossBorder { get; init; }

        /// <summary>Bill payment: tag 30.01.</summary>
        public string? BillerId { get; init; }

        /// <summary>Bill payment: tag 30.02.</summary>
        public string? Reference1 { get; init; }

        /// <summary>Bill payment: tag 30.03.</summary>
        public string? Reference2 { get; init; }
    }
}

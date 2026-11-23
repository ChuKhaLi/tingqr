namespace TingQR
{
    /// <summary>Tag 29 (individual) or tag 30 (merchant) of a KHQR.</summary>
    public enum KhqrAccountType
    {
        /// <summary>Tag 29.</summary>
        Individual,

        /// <summary>Tag 30.</summary>
        Merchant,
    }

    /// <summary>Tag 64 of the input of <see cref="Khqr.Encode"/>: the only text that may be non-ASCII.</summary>
    /// <param name="Language">Two ASCII letters (ISO 639-1), case kept (64.00).</param>
    /// <param name="MerchantName">Name, at most 25 characters (64.01).</param>
    /// <param name="MerchantCity">City, at most 15 characters (64.02); null to leave it out.</param>
    public sealed record KhqrAlternateLanguage(string Language, string MerchantName, string? MerchantCity = null);

    /// <summary>Input of <see cref="Khqr.Encode"/>.</summary>
    public sealed record KhqrInput
    {
        /// <summary>Individual (tag 29) or merchant (tag 30).</summary>
        public required KhqrAccountType AccountType { get; init; }

        /// <summary>Bakong account <c>name@bank</c>: exactly one '@', at most 32 characters.</summary>
        public required string BakongAccountId { get; init; }

        /// <summary>Individual only (29.01), at most 32 characters.</summary>
        public string? AccountInformation { get; init; }

        /// <summary>Merchant only and required (30.01), at most 32 characters.</summary>
        public string? MerchantId { get; init; }

        /// <summary>Required for a merchant (30.02), optional for an individual (29.02); at most 32 characters.</summary>
        public string? AcquiringBank { get; init; }

        /// <summary>Tag 59, 1-25 characters.</summary>
        public required string MerchantName { get; init; }

        /// <summary>Tag 60, at most 15 characters; <c>Phnom Penh</c> by default.</summary>
        public string? MerchantCity { get; init; }

        /// <summary>Tag 52, 4 digits; <c>5999</c> by default.</summary>
        public string? MerchantCategoryCode { get; init; }

        /// <summary><c>KHR</c> / <c>USD</c>, or the numeric <c>116</c> / <c>840</c> that <see cref="Khqr.Decode"/> returns in <see cref="KhqrData.Currency"/>.</summary>
        public required string Currency { get; init; }

        /// <summary>KHR: a whole number greater than 0. USD: greater than 0 with at most 2 decimals. Null: a static code.</summary>
        public QrAmount? Amount { get; init; }

        /// <summary>62.01, at most 25 characters.</summary>
        public string? BillNumber { get; init; }

        /// <summary>62.02, at most 25 characters.</summary>
        public string? MobileNumber { get; init; }

        /// <summary>62.03, at most 25 characters.</summary>
        public string? StoreLabel { get; init; }

        /// <summary>62.07, at most 25 characters.</summary>
        public string? TerminalLabel { get; init; }

        /// <summary>62.08, at most 25 characters.</summary>
        public string? Purpose { get; init; }

        /// <summary>Tag 64.</summary>
        public KhqrAlternateLanguage? AlternateLanguage { get; init; }

        /// <summary>
        /// Unix milliseconds (13 digits). Required so the output never depends on the clock. Written to 99.00 only
        /// together with <see cref="ExpiresAt"/>: a static code without it has no tag 99, so this value is checked and
        /// then left out.
        /// </summary>
        public required long CreatedAt { get; init; }

        /// <summary>Unix milliseconds (13 digits), after <see cref="CreatedAt"/>. Required with an amount.</summary>
        public long? ExpiresAt { get; init; }
    }
}

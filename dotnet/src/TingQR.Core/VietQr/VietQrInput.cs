namespace TingQR
{
    /// <summary>Input of <see cref="VietQr.Encode"/>.</summary>
    public sealed record VietQrInput
    {
        /// <summary>6-digit bank BIN, e.g. <c>970422</c>.</summary>
        public required string BankBin { get; init; }

        /// <summary>Account or card number, 3–25 ASCII letters or digits.</summary>
        public required string AccountNumber { get; init; }

        /// <summary>Defaults to <see cref="VietQrServiceCode.Account"/>.</summary>
        public VietQrServiceCode Service { get; init; } = VietQrServiceCode.Account;

        /// <summary>Whole VND, 1–13 digits, greater than zero. Null (or empty text) for a static QR.</summary>
        public QrAmount? Amount { get; init; }

        /// <summary>Transfer note (tag 62.08). Printable ASCII only, at most 95 characters; null or empty for none.</summary>
        public string? Purpose { get; init; }
    }
}

namespace TingQR
{
    /// <summary>Input of <see cref="PromptPayQr.Encode"/>.</summary>
    public sealed record PromptPayInput
    {
        /// <summary>The recipient.</summary>
        public required PromptPayTarget Target { get; init; }

        /// <summary>THB, greater than zero, at most 2 decimals and 9999999999.99. Written with two decimals (<c>30.00</c>). Null for a static QR.</summary>
        public QrAmount? Amount { get; init; }
    }
}

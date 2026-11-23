namespace TingQR
{
    /// <summary>The payment QR schemes <see cref="TingQrDetector"/> recognises. JSON names: vietqr, vnpay, promptpay, khqr.</summary>
    public enum QrScheme
    {
        /// <summary>VietQR (NAPAS).</summary>
        VietQr,

        /// <summary>VNPAY-QR.</summary>
        Vnpay,

        /// <summary>Thai PromptPay.</summary>
        PromptPay,

        /// <summary>Cambodian KHQR.</summary>
        Khqr,
    }
}

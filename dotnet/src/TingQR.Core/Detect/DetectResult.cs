using System.Collections.Generic;

namespace TingQR
{
    /// <summary>The scheme a payload was recognised as, with its data.</summary>
    /// <param name="Scheme">The first scheme in the try order that recognised the payload.</param>
    /// <param name="Data">A <see cref="VietQrData"/>, <see cref="VnpayQrData"/>, <see cref="PromptPayData"/> or <see cref="KhqrData"/>, matching <paramref name="Scheme"/>.</param>
    /// <param name="AlsoMatches">Later schemes in the try order that also recognise the payload (e.g. a shop QR with both VietQR and VNPAY).</param>
    public sealed record DetectResult(QrScheme Scheme, object Data, IReadOnlyList<QrScheme> AlsoMatches);
}

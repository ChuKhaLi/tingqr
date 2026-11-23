using System;
using System.Collections.Generic;
using TingQR.Emv;

namespace TingQR
{
    /// <summary>Recognises which payment QR scheme a payload is.</summary>
    public static class TingQrDetector
    {
        private delegate TingQrResult<object> Reader(EmvPayload p, IReadOnlyList<TingQrWarning> warnings);

        private static TingQrResult<object> Box<T>(TingQrResult<T> r) where T : class
            => r.Ok ? TingQrResult<object>.Success(r.Value!, r.Warnings) : TingQrResult<object>.Failure(r.Error!);

        // Try order. A reader "recognises" a payload unless it returns UNSUPPORTED_SCHEME. Always lenient.
        private static readonly KeyValuePair<QrScheme, Reader>[] Readers =
        {
            new KeyValuePair<QrScheme, Reader>(QrScheme.VietQr, (p, w) => Box(VietQr.Read(p, w, ParseMode.Lenient))),
            new KeyValuePair<QrScheme, Reader>(QrScheme.Vnpay, (p, w) => Box(VnpayQr.Read(p, w, ParseMode.Lenient))),
            new KeyValuePair<QrScheme, Reader>(QrScheme.PromptPay, (p, w) => Box(PromptPayQr.Read(p, w, ParseMode.Lenient))),
            new KeyValuePair<QrScheme, Reader>(QrScheme.Khqr, (p, w) => Box(Khqr.Read(p, w, ParseMode.Lenient))),
        };

        /// <summary>
        /// Reads any payment QR tingqr supports. The payload is parsed once; schemes are tried in the order VietQR,
        /// VNPAY, PromptPay, KHQR, in lenient mode. The first scheme that recognises the payload gives the result, or
        /// its error (an error is not a reason to try the next scheme). No scheme: UNKNOWN_SCHEME with the top-level
        /// fields in <see cref="TingQrException.Fields"/>. Never throws on bad data, including null.
        /// </summary>
        public static TingQrResult<DetectResult> Detect(string? payload)
        {
            var parsed = EmvPayloads.Parse(payload);
            if (!parsed.Ok) return TingQrResult<DetectResult>.Failure(parsed.Error!);
            var p = parsed.Value!;
            QrScheme? foundScheme = null;
            object? foundData = null;
            IReadOnlyList<TingQrWarning> foundWarnings = parsed.Warnings;
            var also = new List<QrScheme>();
            foreach (var entry in Readers)
            {
                var r = entry.Value(p, parsed.Warnings);
                if (!r.Ok && r.Error!.Code == TingQrErrorCode.UnsupportedScheme) continue;
                if (foundScheme != null)
                {
                    also.Add(entry.Key);
                    continue;
                }
                if (!r.Ok) return TingQrResult<DetectResult>.Failure(r.Error!);
                foundScheme = entry.Key;
                foundData = r.Value;
                foundWarnings = r.Warnings;
            }
            if (foundScheme == null)
            {
                return TingQrResult<DetectResult>.Failure(new TingQrException(TingQrErrorCode.UnknownScheme,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Not a payment QR tingqr knows (VietQR, VNPAY, PromptPay, KHQR).", null, p.Fields));
            }
            return TingQrResult<DetectResult>.Success(new DetectResult(foundScheme.Value, foundData!, also), foundWarnings);
        }
    }
}

namespace TingQR.AspNetCore;

/// <summary>
/// VietQR codes to the receiving account configured with
/// <see cref="TingQrServiceCollectionExtensions.AddTingQr(Microsoft.Extensions.DependencyInjection.IServiceCollection, System.Action{TingQrOptions}?)"/>.
/// Registered as a singleton.
/// </summary>
public sealed class TingQrService
{
    private readonly ResolvedTingQr _config;

    internal TingQrService(ResolvedTingQr config)
    {
        _config = config;
    }

    /// <summary>BIN of the configured bank, e.g. "970422"; null when no receiving account is configured.</summary>
    public string? Bin => _config.Bank?.Bin;

    /// <summary>
    /// The configured bank (code, short and full name…), e.g. to show its name next to the code; null when no receiving
    /// account is configured.
    /// </summary>
    public Bank? Bank => _config.Bank;

    /// <summary>
    /// VietQR payload to the configured account. Without an amount it is a static code. Bad input throws
    /// <see cref="TingQrException"/> (e.g. <see cref="TingQrErrorCode.InvalidValue"/> for the amount,
    /// <see cref="TingQrErrorCode.NonAscii"/> for a purpose with accents), as does a call without a receiving account.
    /// </summary>
    /// <param name="amount">Amount in VND; null for a static code.</param>
    /// <param name="purpose">Transfer note (ASCII).</param>
    public string PaymentQr(QrAmount? amount = null, string? purpose = null)
    {
        if (_config.Bank is null)
        {
            throw new TingQrException(TingQrErrorCode.InvalidValue, "No receiving account: call AddTingQr with Bank and AccountNumber.");
        }
        return VietQr.Encode(new VietQrInput
        {
            BankBin = _config.Bank.Bin,
            AccountNumber = _config.AccountNumber!,
            Service = _config.Service,
            Amount = amount,
            Purpose = purpose,
        });
    }
}

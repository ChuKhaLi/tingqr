namespace TingQR
{
    /// <summary>A Vietnamese bank or wallet from api.vietqr.io/v2/banks (conformance/banks/banks.json).</summary>
    /// <param name="Bin">6-digit BIN, as in VietQR tag 38.01.00.</param>
    /// <param name="Code">vietqr.io short code, e.g. <c>MB</c>.</param>
    /// <param name="ShortName">Short name, e.g. <c>MBBank</c>.</param>
    /// <param name="Name">Full name.</param>
    /// <param name="Swift">SWIFT code, or null when vietqr.io lists none.</param>
    /// <param name="LogoUrl">Reference link to the logo on cdn.vietqr.io. Loading it calls the network.</param>
    public sealed record Bank(string Bin, string Code, string ShortName, string Name, string? Swift, string LogoUrl);
}

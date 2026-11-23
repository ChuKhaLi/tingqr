namespace TingQR.Emv
{
    /// <summary>How strictly a reader treats deviations from the scheme specification.</summary>
    public enum ParseMode
    {
        /// <summary>Accept known deviations and report them as warnings.</summary>
        Lenient,

        /// <summary>Reject deviations.</summary>
        Strict,
    }
}

namespace TingQR
{
    /// <summary>Point of initiation (tag 01): <c>11</c> static, <c>12</c> dynamic. JSON: <c>static</c>/<c>dynamic</c>.</summary>
    public enum QrInitiation
    {
        /// <summary>Tag 01 is <c>11</c>: reusable, usually without an amount.</summary>
        Static,

        /// <summary>Tag 01 is <c>12</c>: one payment, usually with an amount.</summary>
        Dynamic,
    }
}

namespace TingQR.Rendering
{
    /// <summary>QR error correction level.</summary>
    public enum Ecc
    {
        /// <summary>Low: about 7% of codewords can be restored.</summary>
        L,

        /// <summary>Medium: about 15% of codewords can be restored. The default.</summary>
        M,

        /// <summary>Quartile: about 25% of codewords can be restored. Suits printed signs that get dirty or scratched.</summary>
        Q,

        /// <summary>High: about 30% of codewords can be restored.</summary>
        H,
    }
}

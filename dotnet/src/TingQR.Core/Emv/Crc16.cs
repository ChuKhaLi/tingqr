using System.Globalization;
using System.Text;

namespace TingQR.Emv
{
    /// <summary>CRC-16/CCITT-FALSE as used by EMV QR payloads.</summary>
    public static class Crc16
    {
        /// <summary>CRC over the UTF-8 bytes of <paramref name="input"/> (poly 0x1021, init 0xFFFF), as 4 uppercase hex digits.</summary>
        public static string Compute(string input)
        {
            var crc = 0xFFFF;
            // Lone surrogates encode as U+FFFD, same as the TS implementation.
            foreach (var b in new UTF8Encoding(false, false).GetBytes(input))
            {
                crc ^= b << 8;
                for (var bit = 0; bit < 8; bit++)
                {
                    crc = (crc & 0x8000) != 0 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
                }
            }
            return crc.ToString("X4", CultureInfo.InvariantCulture);
        }
    }
}

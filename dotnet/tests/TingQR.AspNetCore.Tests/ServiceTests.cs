using Xunit;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace TingQR.AspNetCore.Tests;

public class ServiceTests
{
    private static async Task<(WebApplication App, TingQrService Service)> Mb()
    {
        var app = await TestApp.StartAsync(o =>
        {
            o.Bank = "mb";
            o.AccountNumber = TestApp.Account;
        });
        return (app, app.Services.GetRequiredService<TingQrService>());
    }

    [Fact]
    public async Task Static_code_is_VietQr_Encode_of_the_same_input()
    {
        var (app, service) = await Mb();
        await using var _ = app;
        Assert.Equal(VietQr.Encode(new VietQrInput { BankBin = "970422", AccountNumber = TestApp.Account }), service.PaymentQr());
        Assert.Equal("970422", service.Bin);
        Assert.Equal("MB", service.Bank!.Code);
    }

    [Fact]
    public async Task Amount_and_purpose_match_the_conformance_vector()
    {
        var (app, service) = await Mb();
        await using var _ = app;
        var vector = JsonDocument.Parse(File.ReadAllText(Path.Combine(ConformanceRoot.Path, "vectors", "vietqr", "vietqr-dynamic-amount-purpose.json")));
        Assert.Equal(vector.RootElement.GetProperty("payload").GetString(), service.PaymentQr("50000", "TINGQR TEST"));
        Assert.Equal(vector.RootElement.GetProperty("payload").GetString(), service.PaymentQr(50000, "TINGQR TEST"));
    }

    [Fact]
    public async Task Accented_purpose_is_NonAscii()
    {
        // conformance/vectors/vietqr/vietqr-encode-purpose-accented.json
        var (app, service) = await Mb();
        await using var _ = app;
        var e = Assert.Throws<TingQrException>(() => service.PaymentQr(purpose: "Chuyển tiền"));
        Assert.Equal(TingQrErrorCode.NonAscii, e.Code);
    }

    [Fact]
    public async Task Bad_amount_is_the_core_error()
    {
        var (app, service) = await Mb();
        await using var _ = app;
        var e = Assert.Throws<TingQrException>(() => service.PaymentQr("0"));
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
    }

    [Fact]
    public async Task No_account_throws_InvalidValue()
    {
        await using var app = await TestApp.StartAsync(_ => { });
        var service = app.Services.GetRequiredService<TingQrService>();
        Assert.Null(service.Bin);
        Assert.Null(service.Bank);
        var e = Assert.Throws<TingQrException>(() => service.PaymentQr());
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("No receiving account: call AddTingQr with Bank and AccountNumber.", e.Message);
    }

    [Fact]
    public async Task Service_is_a_singleton()
    {
        var (app, service) = await Mb();
        await using var _ = app;
        Assert.Same(service, app.Services.GetRequiredService<TingQrService>());
    }
}

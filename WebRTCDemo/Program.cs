using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Thêm SignalR cho signaling
builder.Services.AddSignalR();
// Thêm CORS để có thể kết nối từ điện thoại
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

var app = builder.Build();

// Cấu hình ứng dụng
app.UseStaticFiles(); // Để phục vụ file HTML, JavaScript
app.UseCors("AllowAll");
app.UseRouting();

app.MapHub<SignalingHub>("/signalhub");
app.MapGet("/", () => Results.Redirect("/index.html"));

// Xác định IP máy tính local để hiển thị
var ip = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()
    .SelectMany(i => i.GetIPProperties().UnicastAddresses)
    .FirstOrDefault(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork
                       && !System.Net.IPAddress.IsLoopback(a.Address))?.Address.ToString() ?? "localhost";

Console.WriteLine($"WebRTC server running on http://{ip}:5000");
Console.WriteLine("Use this address on your phone browser to connect");

app.Run();
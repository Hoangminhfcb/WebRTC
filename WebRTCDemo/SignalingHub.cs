using Microsoft.AspNetCore.SignalR;

public class SignalingHub : Hub
{
    // Xử lý kết nối mới
    public override async Task OnConnectedAsync()
    {
        Console.WriteLine($"Client connected: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    // Xử lý ngắt kết nối
    public override async Task OnDisconnectedAsync(Exception exception)
    {
        Console.WriteLine($"Client disconnected: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }

    // Phương thức nhận và gửi offer
    public async Task SendOffer(string offer)
    {
        Console.WriteLine($"Offer received from {Context.ConnectionId}");
        // Gửi offer đến tất cả client khác
        await Clients.Others.SendAsync("ReceiveOffer", offer, Context.ConnectionId);
    }

    // Phương thức nhận và gửi answer
    public async Task SendAnswer(string answer, string targetConnectionId)
    {
        Console.WriteLine($"Answer received from {Context.ConnectionId}");
        // Gửi answer đến client cụ thể
        await Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", answer, Context.ConnectionId);
    }

    // Phương thức nhận và gửi ice candidate
    public async Task SendIceCandidate(string candidate, string targetConnectionId)
    {
        // Gửi ice candidate đến client cụ thể hoặc tất cả client khác nếu không chỉ định
        if (!string.IsNullOrEmpty(targetConnectionId))
        {
            await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", candidate, Context.ConnectionId);
        }
        else
        {
            await Clients.Others.SendAsync("ReceiveIceCandidate", candidate, Context.ConnectionId);
        }
    }
}
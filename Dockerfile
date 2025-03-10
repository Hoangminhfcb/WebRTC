# Sử dụng image cơ sở .NET SDK để build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy file csproj và restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy toàn bộ mã nguồn và build
COPY . ./
RUN dotnet publish -c Release -o out

# Sử dụng image runtime để chạy ứng dụng
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/out ./

# Cổng mà ứng dụng sẽ chạy
EXPOSE 5001

# Thiết lập biến môi trường cho cổng
ENV ASPNETCORE_URLS=http://+:5001

# Chạy ứng dụng
ENTRYPOINT ["dotnet", "WebRTCDemo.dll"]
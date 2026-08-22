FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.21
# ca-certificates for outbound Frankfurter/Resend; tzdata or RECURRING_TZ
# silently falls back to UTC and the scheduler uses the wrong calendar.
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
USER app

COPY --from=build /out/server /usr/local/bin/server

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/server"]

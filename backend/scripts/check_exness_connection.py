"""Read the backend's local diagnostic socket without accessing credentials."""

import argparse
import json
import socket


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--socket", default="/var/lib/nttotv/execution-monitor.sock")
    parser.add_argument("--probe", action="store_true", help="Also run fixed read-only account API checks")
    args = parser.parse_args()
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.settimeout(90 if args.probe else 5)
        connection.connect(args.socket)
        connection.sendall(b"probe\n" if args.probe else b"status\n")
        with connection.makefile("rb") as reader:
            result = json.loads(reader.readline(1024*1024))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

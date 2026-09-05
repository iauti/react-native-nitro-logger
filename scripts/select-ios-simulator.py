"""Print GitHub Actions environment values for one available iPhone simulator."""
import json
import subprocess

inventory = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"]))
for runtime, devices in inventory["devices"].items():
    if ".iOS-" not in runtime:
        continue
    for device in devices:
        if device.get("isAvailable") and device["name"].startswith("iPhone"):
            print(f'HARNESS_IOS_DEVICE={device["name"]}')
            print(f'HARNESS_IOS_VERSION={runtime.split(".iOS-")[1].replace("-", ".")}')
            print(f'HARNESS_IOS_UDID={device["udid"]}')
            raise SystemExit(0)
raise SystemExit("No available iPhone simulator; install an iOS runtime before running native tests.")

import hmac
from collections import defaultdict, deque
from time import monotonic

from fastapi import HTTPException, Request, status


def verify_password(candidate: str, expected: str) -> bool:
    return hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8"))


def require_login(request: Request) -> None:
    if request.session.get("authenticated") is not True:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue")


class LoginLimiter:
    def __init__(self, attempts: int = 5, window_seconds: int = 300):
        self.attempts = attempts
        self.window_seconds = window_seconds
        self.failures: dict[str, deque[float]] = defaultdict(deque)

    def check(self, client: str) -> None:
        now = monotonic()
        recent = self.failures[client]
        while recent and now - recent[0] > self.window_seconds:
            recent.popleft()
        if len(recent) >= self.attempts:
            raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again later.")

    def record_failure(self, client: str) -> None:
        self.failures[client].append(monotonic())

    def clear(self, client: str) -> None:
        self.failures.pop(client, None)

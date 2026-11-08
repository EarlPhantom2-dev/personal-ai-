import httpx


class ProviderError(Exception):
    pass


class NineRouter:
    def __init__(self, base_url: str, api_key: str, chat_model: str, embedding_model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.chat_model = chat_model
        self.embedding_model = embedding_model

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def _post(self, path: str, payload: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
                response = await client.post(f"{self.base_url}/{path}", headers=self._headers(), json=payload)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderError("AI provider request failed. Check 9Router and model settings.") from exc

    async def chat(self, messages: list[dict[str, str]]) -> str:
        result = await self._post("chat/completions", {"model": self.chat_model, "messages": messages})
        try:
            content = result["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("AI provider returned an unreadable chat response.") from exc
        if not isinstance(content, str) or not content.strip():
            raise ProviderError("AI provider returned an empty response.")
        return content.strip()

    async def embed(self, text: str) -> list[float]:
        result = await self._post("embeddings", {"model": self.embedding_model, "input": text})
        try:
            values = result["data"][0]["embedding"]
            if not values or not all(isinstance(value, (int, float)) for value in values):
                raise ValueError("invalid embedding")
            return [float(value) for value in values]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError("Embedding provider returned an unreadable response.") from exc

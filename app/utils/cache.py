import os

import redis

redis_client = redis.StrictRedis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    username=os.getenv("REDIS_USERNAME", "default"),
    password=os.getenv("REDIS_PASSWORD", ""),
    ssl=os.getenv("REDIS_SSL", "true").lower() in {"1", "true", "yes"},
    decode_responses=True,
)
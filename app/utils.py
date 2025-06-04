from decimal import Decimal
from flask.json.provider import DefaultJSONProvider


class CustomJSONProvider(DefaultJSONProvider):
    """JSON provider that converts ``Decimal`` instances to ``float``."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

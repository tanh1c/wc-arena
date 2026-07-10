from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Formation = Literal["4-3-3", "4-2-3-1", "3-5-2"]
BotId = Literal["starter", "pressing-academy", "defensive-wall"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class XiSelection(StrictModel):
    slot_id: str = Field(min_length=1, max_length=12)
    owned_card_id: str


class MatchLabRunRequest(StrictModel):
    formation: Formation
    bot_id: BotId
    xi: list[XiSelection] = Field(min_length=11, max_length=11)
    debug: bool = False


class MatchLabFeedbackRequest(StrictModel):
    fun_rating: int = Field(ge=1, le=5)
    clarity_rating: int = Field(ge=1, le=5)
    fairness_rating: int = Field(ge=1, le=5)
    feedback_text: str | None = Field(default=None, max_length=1000)

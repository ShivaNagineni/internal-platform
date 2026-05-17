import uuid
from beanie.odm.operators.update.general import Inc
from app.models.idea import Idea, IdeaVote


async def toggle_vote(idea_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    existing = await IdeaVote.find_one(
        IdeaVote.idea_id == idea_id,
        IdeaVote.user_id == user_id,
    )

    if existing:
        await existing.delete()
        await Idea.find_one(Idea.id == idea_id).update(Inc({Idea.upvote_count: -1}))
        return False
    else:
        vote = IdeaVote(idea_id=idea_id, user_id=user_id)
        await vote.insert()
        await Idea.find_one(Idea.id == idea_id).update(Inc({Idea.upvote_count: 1}))
        return True


async def has_voted(idea_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return await IdeaVote.find_one(
        IdeaVote.idea_id == idea_id,
        IdeaVote.user_id == user_id,
    ) is not None

import json
import logging
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import ExamPaper, ExamQuestion

logger = logging.getLogger(__name__)


def load_exam_from_json(json_data: dict) -> tuple:
    title = json_data.get("title")
    subject = json_data.get("subject")
    year = json_data.get("year")
    if not title or not subject or not year:
        raise ValueError("title, subject, year are required in exam JSON")

    paper = ExamPaper(
        title=title,
        subject=subject,
        year=year,
        exam_type=json_data.get("exam_type"),
        description=json_data.get("description"),
        total_score=json_data.get("total_score", 150.0),
        duration_minutes=json_data.get("duration_minutes", 180),
    )

    questions = []
    sections = json_data.get("sections", [])
    for section in sections:
        section_name = section.get("name", "")
        for q_data in section.get("questions", []):
            question = ExamQuestion(
                section_name=section_name,
                question_order=q_data.get("order", 1),
                question_text=q_data.get("text", ""),
                question_type=q_data.get("type", "single_choice"),
                options=q_data.get("options"),
                answer=q_data.get("answer"),
                explanation=q_data.get("explanation"),
                score=q_data.get("score", 0),
                topic=q_data.get("topic"),
            )
            questions.append(question)

    paper.question_count = len(questions)
    return paper, questions


async def load_all_exams_from_dir(directory: str, session: AsyncSession):
    dir_path = Path(directory)
    if not dir_path.exists():
        logger.warning("Exam data directory not found: %s", directory)
        return

    json_files = sorted(dir_path.glob("*.json"))
    if not json_files:
        logger.info("No JSON files found in %s", directory)
        return

    loaded = 0
    skipped = 0
    for json_file in json_files:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            title = data.get("title")
            if not title:
                logger.warning("Skipping %s: no title", json_file.name)
                skipped += 1
                continue

            existing = await session.execute(
                select(ExamPaper).where(ExamPaper.title == title)
            )
            if existing.scalar_one_or_none():
                logger.info("Skipping %s: paper '%s' already exists", json_file.name, title)
                skipped += 1
                continue

            paper, questions = load_exam_from_json(data)
            session.add(paper)
            await session.flush()

            for q in questions:
                q.paper_id = paper.id
                session.add(q)

            loaded += 1
            logger.info("Loaded exam: %s (%d questions)", title, len(questions))
        except Exception as e:
            logger.error("Failed to load %s: %s", json_file.name, e)
            skipped += 1

    await session.commit()
    logger.info("Exam loading complete: %d loaded, %d skipped", loaded, skipped)

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import init_db, async_session
from db.models import QuizQuestion
from sqlalchemy import select


SEED_QUESTIONS = [
    {
        "subject": "政治",
        "topic": "马克思主义基本原理",
        "difficulty": "medium",
        "question_text": "马克思主义哲学认为，物质的唯一特性是：",
        "options": ["A. 运动性", "B. 客观实在性", "C. 可知性", "D. 永恒性"],
        "answer": "B",
        "explanation": "物质的唯一特性是客观实在性。列宁指出：'物质的唯一特性就是：它存在于我们的意识之外。'客观实在性是物质最根本的特性，是物质区别于意识的根本标志。",
    },
    {
        "subject": "政治",
        "topic": "毛泽东思想",
        "difficulty": "easy",
        "question_text": "毛泽东思想活的灵魂的三个基本方面是：",
        "options": ["A. 统一战线、武装斗争、党的建设", "B. 实事求是、群众路线、独立自主", "C. 理论联系实际、密切联系群众、批评与自我批评", "D. 解放思想、实事求是、与时俱进"],
        "answer": "B",
        "explanation": "毛泽东思想活的灵魂是实事求是、群众路线、独立自主三个基本方面。这是1981年《关于建国以来党的若干历史问题的决议》中明确提出的。",
    },
    {
        "subject": "政治",
        "topic": "中国近现代史纲要",
        "difficulty": "easy",
        "question_text": "标志着中国新民主主义革命开端的历史事件是：",
        "options": ["A. 辛亥革命", "B. 五四运动", "C. 中国共产党成立", "D. 北伐战争"],
        "answer": "B",
        "explanation": "1919年的五四运动标志着中国新民主主义革命的开端。五四运动中工人阶级开始登上政治舞台，促进了马克思主义在中国的传播。",
    },
    {
        "subject": "英语",
        "topic": "词汇",
        "difficulty": "medium",
        "question_text": "Choose the word that best completes the sentence: The government needs to take _____ measures to combat climate change.",
        "options": ["A. effective", "B. efficient", "C. affective", "D. effectual"],
        "answer": "A",
        "explanation": "effective意为'有效的，产生预期效果的'，强调实际效果；efficient意为'高效的'，强调效率；affective意为'情感的'；effectual较少使用。此处指政府需要采取有效措施，选A。",
    },
    {
        "subject": "英语",
        "topic": "写作",
        "difficulty": "hard",
        "question_text": "Which of the following is the most appropriate thesis statement for an essay about the impact of artificial intelligence on employment?",
        "options": [
            "A. AI is changing everything in our lives.",
            "B. While AI threatens certain job categories, it simultaneously creates new employment opportunities, necessitating a proactive approach to workforce retraining.",
            "C. This essay will discuss AI and jobs.",
            "D. AI is bad for workers because it takes their jobs.",
        ],
        "answer": "B",
        "explanation": "B是最合适的thesis statement，因为它：1)明确表达了论点（AI既威胁也创造就业）；2)提出了具体立场（需要积极的再培训）；3)涵盖了文章的主要论点方向。A太宽泛，C太模糊，D太片面。",
    },
    {
        "subject": "英语",
        "topic": "阅读理解",
        "difficulty": "medium",
        "question_text": "In academic writing, when the author uses the phrase 'it is widely acknowledged that', the intended rhetorical effect is to:",
        "options": [
            "A. Express personal opinion",
            "B. Establish a premise as commonly accepted",
            "C. Challenge an existing viewpoint",
            "D. Introduce a controversial argument",
        ],
        "answer": "B",
        "explanation": "'it is widely acknowledged that'（众所周知）的修辞效果是将某个观点建立为普遍接受的前提，从而增强论证的说服力，避免对基础性观点进行过多论证。",
    },
    {
        "subject": "数学",
        "topic": "高等数学-极限",
        "difficulty": "medium",
        "question_text": "lim(x→0) sin(x)/x 的值为：",
        "options": ["A. 0", "B. 1", "C. ∞", "D. 不存在"],
        "answer": "B",
        "explanation": "这是一个重要极限。lim(x→0) sin(x)/x = 1。可以用夹逼准则证明：对于0 < x < π/2，有cos(x) < sin(x)/x < 1，当x→0时，cos(x)→1，由夹逼准则得lim(x→0) sin(x)/x = 1。",
    },
    {
        "subject": "数学",
        "topic": "线性代数-行列式",
        "difficulty": "hard",
        "question_text": "设A为3阶方阵，|A|=2，则|2A|的值为：",
        "options": ["A. 4", "B. 8", "C. 16", "D. 6"],
        "answer": "C",
        "explanation": "对于n阶方阵A和数k，有|kA| = k^n × |A|。这里n=3，k=2，所以|2A| = 2^3 × |A| = 8 × 2 = 16。",
    },
    {
        "subject": "数学",
        "topic": "概率论-随机变量",
        "difficulty": "medium",
        "question_text": "设随机变量X服从参数为λ的泊松分布，则E(X)和D(X)分别为：",
        "options": ["A. λ, λ", "B. λ, λ²", "C. λ², λ", "D. 1/λ, 1/λ²"],
        "answer": "A",
        "explanation": "泊松分布X~P(λ)的期望E(X)=λ，方差D(X)=λ。这是泊松分布的重要性质——期望和方差相等，都等于参数λ。",
    },
    {
        "subject": "数学",
        "topic": "高等数学-积分",
        "difficulty": "easy",
        "question_text": "∫₀¹ x² dx 的值为：",
        "options": ["A. 1/2", "B. 1/3", "C. 1/4", "D. 1"],
        "answer": "B",
        "explanation": "∫₀¹ x² dx = [x³/3]₀¹ = 1³/3 - 0³/3 = 1/3。这是幂函数定积分的基础计算。",
    },
]


async def seed():
    await init_db()
    async with async_session() as session:
        for q_data in SEED_QUESTIONS:
            result = await session.execute(
                select(QuizQuestion).where(QuizQuestion.question_text == q_data["question_text"])
            )
            if result.scalar_one_or_none():
                continue
            q = QuizQuestion(**q_data)
            session.add(q)
        await session.commit()
    print(f"Seeded {len(SEED_QUESTIONS)} questions")


if __name__ == "__main__":
    asyncio.run(seed())

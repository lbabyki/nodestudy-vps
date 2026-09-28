import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { Category } from "@/database/entity/Category.entity";
import { redis } from "@/lib/redis";
import { NEXT_AUTH } from "@/services/NextAuth";
import { getServerSession } from "next-auth";
import { type NextRequest, NextResponse } from "next/server";

const CATEGORIES_CACHE_KEY = "study:categories:all";
const CATEGORIES_CACHE_TTL = 60;

export async function POST(req: NextRequest) {
  const { name, description = null } = await req.json();

  const session = await getServerSession(NEXT_AUTH);

  if (!session || session?.user?.accountType !== "Admin") {
    return NextResponse.json({
      success: false,
      message: "You are not Authorized for this route",
    });
  }

  await InitializeDatabase();

  const existingCategory = await AppDataSource.getRepository(Category).findOne({
    where: { name },
  });

  if (existingCategory) {
    return NextResponse.json({
      success: false,
      message: "Category already exists",
    });
  }

  const newCategory = new Category();
  newCategory.name = name;
  newCategory.description = description;

  try {
    await AppDataSource.getRepository(Category).save(newCategory);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "Error while creating new category",
    });
  }

  // Category data changed, so old cache must be invalidated.
  try {
    await redis.del(CATEGORIES_CACHE_KEY);
  } catch (error) {
    console.error("[Redis] Cache invalidation failed:", error);
  }

  return NextResponse.json({
    success: true,
    message: "Category created successfully",
    category: newCategory,
  });
}

export async function GET() {
  // 1. Try Redis first.
  try {
    const cachedCategories = await redis.get(CATEGORIES_CACHE_KEY);

    if (cachedCategories) {
      return NextResponse.json(
        {
          success: true,
          message: "Got all Categories successfully",
          categories: JSON.parse(cachedCategories),
        },
        {
          headers: {
            "X-Cache": "HIT",
          },
        },
      );
    }
  } catch (error) {
    console.error("[Redis] Cache read failed:", error);
  }

  // 2. Cache miss -> query MariaDB.
  await InitializeDatabase();

  const categories = await AppDataSource.getRepository(Category).find({
    relations: ["courses"],
  });

  // 3. Save database result to Redis for 60 seconds.
  try {
    await redis.set(
      CATEGORIES_CACHE_KEY,
      JSON.stringify(categories),
      "EX",
      CATEGORIES_CACHE_TTL,
    );
  } catch (error) {
    console.error("[Redis] Cache write failed:", error);
  }

  return NextResponse.json(
    {
      success: true,
      message: "Got all Categories successfully",
      categories: categories,
    },
    {
      headers: {
        "X-Cache": "MISS",
      },
    },
  );
}

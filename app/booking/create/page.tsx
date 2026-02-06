"use client"
import { useState } from "react";
import { ProductCard } from "@/app/_components/(booking)/ProductCard";

export default function CreatePage(){
    const [cards, setCards] = useState([0])

    const addCard = () => {
        setCards((prev) => [...prev, prev.length]);
    }
    return (
        <>
        {cards.map((id)=>(
            <ProductCard key={id}/>
        ))}
        <button className="btn cursor-pointer" onClick={addCard}>Add extra products</button>
        </>
    )
}
import {notFound} from "next/navigation";
import {contentPage} from "@/lib/content";
import {ContentView} from "@/components/content-page";
import type {Metadata} from "next";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const page=await contentPage("blog",slug);return {title:page?.seoTitle||page?.title,description:page?.seoDescription||undefined,alternates:{canonical:`/blog/${slug}`}};}
export default async function Page({params}:Props){const {slug}=await params;const page=await contentPage("blog",slug);if(!page)notFound();return <ContentView page={page}/>;}

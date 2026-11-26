import {allProducts} from "@/lib/catalog";
import {MessageForm} from "@/components/message-form";
import {noindexMeta} from "@/lib/seo";
import type {Metadata} from "next";
export async function generateMetadata():Promise<Metadata>{return noindexMeta("/sav","Demande SAV — FAW","Demande de service après-vente FAW Aluminium : produit, référence de la demande et problème rencontré.");}
export default async function Sav(){const products=(await allProducts()).map(p=>({id:p.id,title:p.title}));return <section className="shell section-y max-w-3xl"><p className="eyebrow text-copper">Assistance</p><h1 className="mt-4 text-d1">Demande de service après-vente</h1><p className="mt-5 text-muted-foreground">Indiquez le produit, la référence de votre demande et le problème rencontré. Les conditions de prise en charge sont examinées par l’équipe ; aucune garantie non confirmée n’est annoncée ici.</p><MessageForm kind="sav" products={products}/></section>;}
